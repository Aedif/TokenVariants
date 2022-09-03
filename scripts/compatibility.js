// v10 compatibility code

export function getTokenImg(token) {
  if (isNewerVersion('10', game.version)) {
    if (token.data) return token.data.img;
    else return token.img;
  } else {
    console.log('getTokenImg', token);
    if (token.document) {
      return token.document.texture.src;
    } else if (token.texture) {
      return token.texture.src;
    } else {
      console.log('WARNING WEIRD TOKEN', token);
    }
  }
}

export function emptyObject(obj) {
  if (isNewerVersion('10', game.version)) {
    return foundry.utils.isObjectEmpty(obj);
  } else {
    return foundry.utils.isEmpty(obj);
  }
}

export function getData(obj) {
  if (isNewerVersion('10', game.version)) {
    return obj.data;
  } else {
    return obj.document ? obj.document : obj;
  }
}
