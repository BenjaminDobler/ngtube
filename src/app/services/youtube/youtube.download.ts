import {combineLatest, Observable} from 'rxjs';
import {createWriteStream} from 'fs';
import {join} from 'path';
import {downloadDir} from '../../util/util';
import {filter, first, map, share, takeUntil} from 'rxjs/operators';
import {EventEmitter} from '@angular/core';

const ffmpeg = require('fluent-ffmpeg');
const staticffmpeg = require('ffmpeg-static-electron');
const filenameify = require('filenamify');
ffmpeg.setFfmpegPath(staticffmpeg.path);
const ytdl = require('ytdl-core');


export class YoutubeDownload {

  public change: EventEmitter<any> = new EventEmitter<any>();

  constructor(public info, public url: string) {
    const hqFormat = this.info.formats.find(x => x.type === 'HQ Audio & Video');
    if (!hqFormat) {
      this.info.formats.push({type: 'HQ Audio & Video'});
    }

    this.info.url = url;
  }

  download(format?: any) {
    if (!format) {
      format = this.info.formats.find(x => x.type === 'HQ Audio & Video');
    }
    const formatIndex = this.info.formats.indexOf(format);
    const filePath = join(downloadDir, filenameify(this.info.title) + '_' + formatIndex + '.' + format.container);

    let $download;

    if (format.type === 'HQ Audio & Video') {
      $download = this.downloadHQ().pipe(share());
    } else {
      $download = this.downloadFile$(filePath, format).pipe(share());
    }
    format.$download = $download;
    $download.subscribe((data) => {
      format.download = data;
      this.change.emit();
    });
  }

  downloadFile$(dest, format) {
    return new Observable(observer => {
      let total = 1;
      let loaded = 0;
      let progress = 0;
      const videoDownload = ytdl(this.url, {format});
      videoDownload.on('progress', (a, l, t, d) => {
        loaded = l;
        total = t;
        progress = Math.round((l / t) * 100);
        observer.next({type: 'PROGRESS', loaded, total, progress, file: dest});
      });

      videoDownload.on('finish', () => {
        console.log('Finish ');

        observer.next({type: 'FINISH', loaded, total, progress, file: dest});
      });

      videoDownload.on('error', e => {
        console.log('Error ', e);
        observer.next({
          type: 'ERROR',
          error: e,
          loaded,
          total,
          progress
        });
      });

      videoDownload.pipe(createWriteStream(dest));

      return function unsubscribe() {
      };
    });
  }


  downloadHQ() {

    const audioOutput = join(downloadDir, filenameify(this.info.title) + 'audio_HQ.ma4');
    const videoOutput = join(downloadDir, filenameify(this.info.title) + 'video_HQ.mp4');
    const mergedOutput = join(downloadDir, filenameify(this.info.title) + '_HQ.mp4');

    const audioFormat = this.info.formats.find(format => format.container === 'm4a' && !format.encoding);
    const videoFormat = this.info.formats.find(format => format.container === 'mp4' && !format.audioEncoding);

    const sound$ = this.downloadFile$(audioOutput, audioFormat).pipe(share());

    const video$ = this.downloadFile$(videoOutput, videoFormat).pipe(share());

    const done = combineLatest(video$, sound$).pipe(
      map((d: any) => {
        const unfinished = d.find(x => x.type !== 'FINISH');
        if (unfinished) {
          return false;
        } else {
          return true;
        }
      }),
      filter(x => x),
      first(),
      share()
    );

    const progress$ = combineLatest(video$, sound$).pipe(
      map(d => {
        const res = d.reduce(
          (prev: any, next: any) => {
            return {
              total: prev.total + next.total,
              loaded: prev.loaded + next.loaded,
              progress: Math.round(((prev.loaded + next.loaded) / (prev.total + next.total)) * 100),
              file: mergedOutput
            };
          },
          {total: 0, loaded: 0}
        );
        return res;
      }),
      takeUntil(done),
      share()
    );

    done.subscribe(() => {
      ffmpeg()
        .input(videoOutput)
        .videoCodec('copy')
        .input(audioOutput)
        .audioCodec('copy')
        .save(mergedOutput)
        .on('error', console.error)
        .on('progress', progress => {
          console.log('Progress ', progress);
        })
        .on('end', async () => {
          // await this.unlink(audioOutput);
          // await this.unlink(videoOutput);
        });
    });

    return progress$;

  }


}
