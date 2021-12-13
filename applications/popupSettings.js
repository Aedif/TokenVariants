export default class PopUpSettings extends FormApplication {

    constructor() {
        super({}, {title: `Pop-up Settings`});
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "token-variants-popup-settings",
            classes: ["sheet"],
            template: "modules/token-variants/templates/popupSettings.html",
            resizable: false,
            minimizable: false,
            closeOnSubmit: true,
            width: 600,
            height: "auto",
            dragDrop: [{dragSelector: null, dropSelector: null}]
        });
    }

    async getData(options) {
        const data = super.getData(options);
        return mergeObject(data, game.settings.get("token-variants", "popupSettings"));
    }

    async _updateObject(event, formData) {
        game.settings.set("token-variants", "popupSettings", formData);
    }
}
