


export function isPlayerUrl(url) {
  const re: RegExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/watch\?v=([^&]+)/m;
  return url.match(re);
}
