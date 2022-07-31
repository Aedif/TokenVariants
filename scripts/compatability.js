export function getTokenImg(token) {
  if (isNewerVersion('10', game.version)) {
    return token.img;
  } else {
    return token.texture.src;
  }
}

export function getTokenData(token) {
  if (isNewerVersion('10', game.version)) {
    return token.data;
  } else {
    return token.document;
  }
}
