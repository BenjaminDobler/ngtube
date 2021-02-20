import { BehaviorSubject, combineLatest, Observable, Subject } from "rxjs";
import {
  createWriteStream,
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { downloadDir } from "../../util/util";
import { filter, first, map, share, takeUntil } from "rxjs/operators";
import { EventEmitter } from "@angular/core";
import { shell } from "electron";

const ffmpeg = require("fluent-ffmpeg");
const staticffmpeg = require("ffmpeg-static-electron");
const filenameify = require("filenamify");
ffmpeg.setFfmpegPath(staticffmpeg.path);
const ytdl = require("ytdl-core");

export interface Format {
  ytFormat: any;
  name: string;
  download$: any;
}

export class YoutubeDownload {
  public change: EventEmitter<any> = new EventEmitter<any>();
  progess$: Observable<any>;
  title: string;
  filename: string;
  formats: any[] = [];

  constructor(public info: any, public url: string) {
    console.log("Info ", info);

    const title = this.info.videoDetails.title;

    info.formats.forEach((f, index) => {
      delete f.$download;
      f.filename = join(
        downloadDir,
        filenameify(title) + "_" + index + "." + f.container
      );
      const exists = existsSync(f.filename);
      f.downloaded = exists;
    });

    let hqFormat = this.info.formats.find((x) => x.type === "HQ Audio & Video");
    if (!hqFormat) {
      hqFormat = { mimeType: "HQ Audio & Video", type: "HQ Audio & Video" };
      this.info.formats.push(hqFormat);
    }
    hqFormat.mimeType = "HQ Audio & Video";
    hqFormat.hasVideo = true;
    hqFormat.hasAudio = true;

    const hqFile = join(downloadDir, filenameify(title) + "_HQ.mp4");

    if (existsSync(hqFile)) {
      hqFormat.downloaded = true;
    }

    this.info.url = url;
  }

  exportAsMp3(format) {
    const formatIndex = this.info.formats.indexOf(format);
    const title = this.info.title || this.info.videoDetails.title;

    let filePath = join(
      downloadDir,
      filenameify(title) + "_" + formatIndex + "." + format.container
    );

    ffmpeg(filePath)
      .format("mp3")
      .save(filePath + ".mp3")
      .on("error", console.error);
  }

  open(format: any) {
    if (!format) {
      format = this.info.formats.find((x) => x.type === "HQ Audio & Video");
    }
    const formatIndex = this.info.formats.indexOf(format);
    const title = this.info.title || this.info.videoDetails.title;

    let filePath = join(
      downloadDir,
      filenameify(title) + "_" + formatIndex + "." + format.container
    );

    if (format.type === "HQ Audio & Video") {
      filePath = join(downloadDir, filenameify(title) + "_HQ.mp4");
    }

    shell.openPath(filePath);
  }

  async refresh() {
    console.log("refresh");
    const info = await ytdl.getInfo(this.info.videoDetails.video_url);
    this.info = info;
    this.change.emit();
  }

  download(format?: any) {
    if (!format) {
      format = this.info.formats.find((x) => x.type === "HQ Audio & Video");
    }
    const formatIndex = this.info.formats.indexOf(format);
    const title = this.info.title || this.info.videoDetails.title;
    const filePath = join(
      downloadDir,
      filenameify(title) + "_" + formatIndex + "." + format.container
    );

    let $download: Observable<any>;

    if (format.type === "HQ Audio & Video") {
      $download = this.downloadHQ(format).pipe(share());
    } else {
      $download = this.downloadFile$(filePath, format).pipe(share());
    }
    format.$download = $download;
    $download.subscribe(
      (data) => {
        format.download = data;
      },
      () => {},
      () => {
        this.change.emit();
      }
    );
  }

  getFilesize(format) {
    return new Promise(() => {
      const videoDownload = ytdl(this.info.videoDetails.video_url, {
        format,
        range: { start: 0, end: 10 },
      });
      videoDownload.on("finish", (...args) => {
        console.log("Finish ", args);
      });
    });
  }

  downloadFile$(dest, format) {
    let partialFile = dest + "partial_download";
    let resume = false;
    let startByte = 0;
    let infoFileWritten = false;
    let initialState = {};
    let result$;

    if (existsSync(dest)) {
      const bytes = statSync(dest).size;

      initialState = {
        progress: 100,
        loaded: bytes,
        total: bytes,
        state: "DOWNLOADED",
      };
      console.log("Already downloaded ");
      result$ = new BehaviorSubject<any>(initialState);
    } else {
      let fileinfo = { total: 0 };
      if (existsSync(partialFile)) {
        resume = true;
        startByte = statSync(partialFile).size;
        infoFileWritten = true;

        fileinfo = JSON.parse(
          readFileSync(dest + ".json", { encoding: "utf-8" })
        );

        initialState = {
          progress: 0,
          loaded: startByte,
          total: fileinfo.total,
          state: "DOWNLOADING",
        };
      } else {
        initialState = {
          progress: 0,
          loaded: 0,
          total: 0,
          state: "DOWNLOADING",
        };
      }
      result$ = new BehaviorSubject<any>(initialState);

      let total = 1;
      let loaded = 0;
      let progress = 0;
      const videoDownload = ytdl(this.info.videoDetails.video_url, {
        format,
        range: { start: startByte },
      });
      videoDownload.on("progress", (chunkSize, l, t) => {
        if (!infoFileWritten) {
          fileinfo = { total: t };
          writeFileSync(dest + ".json", JSON.stringify(fileinfo), {
            encoding: "utf-8",
          });
          infoFileWritten = true;
        }
        loaded = l + startByte;
        progress = Math.round((loaded / fileinfo.total) * 100);

        result$.next({
          type: "PROGRESS",
          loaded,
          total: fileinfo.total,
          progress,
          file: dest,
          state: "LOADING",
        });
      });

      videoDownload.on("finish", () => {
        console.log("Finish ");
        renameSync(partialFile, dest);
        unlinkSync(dest + ".json");
        console.log("after rename");
        format.downloaded = true;
        result$.next({
          type: "FINISH",
          loaded: fileinfo.total,
          total: fileinfo.total,
          progress,
          file: dest,
          state: "DOWNLOADED",
        });
        result$.complete();
      });

      videoDownload.on("error", (e) => {
        console.log("Error ", e);
        result$.next({
          type: "ERROR",
          error: e,
          loaded,
          total,
          progress,
        });
      });

      videoDownload.pipe(createWriteStream(partialFile, { flags: "a" }));
    }

    return result$;
  }

  downloadHQ(format) {
    const title = this.info.title || this.info.videoDetails.title;
    const audioOutput = join(downloadDir, filenameify(title) + "audio_HQ.ma4");
    const videoOutput = join(downloadDir, filenameify(title) + "video_HQ.mp4");
    const mergedOutput = join(downloadDir, filenameify(title) + "_HQ.mp4");

    const audioFormat = this.info.formats.find(
      (format) => format.container === "mp4" && !format.hasVideo
    );

    const videoFormat = this.info.formats
      .filter(
        (format) =>
          format.container === "mp4" &&
          format.hasVideo === true &&
          format.hasAudio === false &&
          !format.audioEncoding
      )
      .sort((a, b) => {
        return a.bitrate < b.bitrate;
      })[0];

    const sound$ = this.downloadFile$(audioOutput, audioFormat);
    const video$ = this.downloadFile$(videoOutput, videoFormat);

    const done = combineLatest([video$, sound$]).pipe(
      map((d: any) => {
        console.log("ddd ", d);

        const unfinished = d.find(
          (x) => x.type !== "FINISH" && x.state !== "DOWNLOADED"
        );
        console.log("unfinished ", unfinished);
        if (unfinished) {
          return false;
        } else {
          console.log("done");
          return true;
        }
      }),
      filter((x) => x),
      first(),
      share()
    );

    const progress$ = combineLatest([video$, sound$]).pipe(
      map((d) => {
        console.log("combined ", d);
        const res = d.reduce(
          (prev: any, next: any) => {
            return {
              total: prev.total + next.total,
              loaded: prev.loaded + next.loaded,
              progress: Math.round(
                ((prev.loaded + next.loaded) / (prev.total + next.total)) * 100
              ),
              file: mergedOutput,
            };
          },
          { total: 0, loaded: 0, progress: 0 }
        );
        return res;
      }),
      takeUntil(done),
      share()
    );

    done.subscribe(() => {
      console.log("download done!");
      ffmpeg()
        .input(videoOutput)
        .videoCodec("copy")
        .input(audioOutput)
        .audioCodec("copy")
        .save(mergedOutput)
        .on("error", console.error)
        .on("progress", (progress) => {
          console.log("Merge Progress ", progress);
        })
        .on("end", async () => {
          // await this.unlink(audioOutput);
          // await this.unlink(videoOutput);
          format.downloaded = true;
        });
    });

    return progress$;
  }
}
