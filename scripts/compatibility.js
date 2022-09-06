// v10 compatibility code
export function getData(obj) {
  if (isNewerVersion('10', game.version)) {
    return obj.data;
  } else {
    return obj.document ? obj.document : obj;
  }
}
