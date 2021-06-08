export default class TokenHUDSettings extends FormApplication {
    constructor() {
        super({}, {});
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "token-variants-hud-settings",
            classes: ["sheet"],
            template: "modules/token-variants/templates/tokenHUD.html",
            resizable: false,
            minimizable: false,
            title: "",
            width: 500
        });
    }

    async getData(options) {
        const data = super.getData(options);
        data.enableTokenHUD = game.settings.get("token-variants", "enableTokenHUD");
        data.displayImage = game.settings.get("token-variants", "HUDDisplayImage");
        data.opacity = game.settings.get("token-variants", "HUDImageOpacity");
        return data;
    }

    /**
     * @param {JQuery} html
     */
    activateListeners(html) {
        super.activateListeners(html);
    }

    /**
     * @param {Event} event
     * @param {Object} formData
     */
    async _updateObject(event, formData) {
        console.log(formData);
        console.log(formData["token-variants-HUDImageOpacity"])
        game.settings.set("token-variants", "enableTokenHUD", formData["enableTokenHUD"]);
        game.settings.set("token-variants", "HUDDisplayImage", formData["HUDDisplayImage"]);
        game.settings.set("token-variants", "HUDImageOpacity", formData["HUDImageOpacity"]);
    }
}
