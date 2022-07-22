// Shows a dialog allowing to edit the overlay configuration as a json string
export function showOverlayJsonConfig(overlayConfig, callback) {
  const config = deepClone(overlayConfig || {});
  delete config.effect;
  let content = `<div style="height: 300px;" class="form-group stacked command"><textarea style="height: 300px;" class="configJson">${JSON.stringify(
    config,
    null,
    2
  )}</textarea></div>`;

  new Dialog({
    title: `Overlay Configuration`,
    content: content,
    buttons: {
      yes: {
        icon: "<i class='fas fa-save'></i>",
        label: 'Save',
        callback: (html) => {
          let json = $(html).find('.configJson').val();
          if (json) {
            try {
              json = JSON.parse(json);
            } catch (e) {
              console.log(e);
              json = {};
            }
          } else {
            json = {};
          }
          callback(json);
        },
      },
    },
    default: 'yes',
  }).render(true);
}
