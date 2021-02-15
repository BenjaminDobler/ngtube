import {YoutubeDownload} from './youtube.download';
import {clipboard} from 'electron';
import {isPlayerUrl} from './youtube.util';
import {join} from 'path';
import {downloadDir} from '../../util/util';
import {existsSync, readFileSync, writeFile, writeFileSync} from 'fs';

const ytdl = require('ytdl-core');


export class YoutubeService {


  constructor() {
    this.load();
    this.watchClipboard();
  }

  public downloads: YoutubeDownload[] = [];


  watchClipboard() {
    let current = '';
    const watch = () => {
      const value = clipboard.readText();
      if (value !== current) {
        if (isPlayerUrl(value)) {
          let myNotification = new Notification('Youtube Download', {
            body: 'Do you want to download this youtube video?'
          });


          console.log("Notification permission", Notification.permission);

          this.download(value);
        }
        current = value;
      }
    };
    setInterval(watch, 1000);
  }

  async download(url) {
    const info = await ytdl.getInfo(url);
    
    const download: YoutubeDownload = new YoutubeDownload(info, url);
    download.change.subscribe(() => {
      // console.log('save!');
      //this.save();
    });
    this.downloads.push(download);
    this.save();

  }

  save() {
    const infos = this.downloads.map(x => x.info);
    const db = join(downloadDir, 'db.json');
    writeFileSync(db, JSON.stringify(infos), {encoding: 'utf-8'});
  }

  load() {
    const db = join(downloadDir, 'db.json');
    if (existsSync(db)) {
      const content = readFileSync(db, {encoding: 'utf-8'});
      const infos = JSON.parse(content);
      infos.forEach((info) => {
        const download: YoutubeDownload = new YoutubeDownload(info, info.url);
        download.change.subscribe(() => {
          //console.log('save!');
          // this.save();
        });
        this.downloads.push(download);
      });

    }
  }

}
