export default class TokenHUDSettings extends FormApplication {
    constructor() {
        super({}, {title: `Token HUD Settings`});
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "token-variants-hud-settings",
            classes: ["sheet"],
            template: "modules/token-variants/templates/tokenHUDSettings.html",
            resizable: false,
            minimizable: false,
            title: "",
            width: 500
        });
    }

    async getData(options) {
        const data = super.getData(options);
        data.tokenHUDWildcardActive = game.modules.get("token-hud-wildcard")?.active;
        const settings = game.settings.get("token-variants", "hudSettings");
        settings.enableWorldSettings = game.user && game.user.can("FILES_BROWSE") && game.user.can("TOKEN_CONFIGURE");
        if(settings.enableWorldSettings){
            settings.enableSideMenuForAll = game.settings.get("token-variants", "enableTokenHUDButtonForAll");
            settings.displaySharedOnly = game.settings.get("token-variants", "displayOnlySharedImages");
            settings.disableSideMenuIfTHW = game.settings.get("token-variants", "disableSideMenuIfTHW");
        }
        return mergeObject(data, settings);
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
        if("enableSideMenuForAll" in formData){
            game.settings.set("token-variants", "enableTokenHUDButtonForAll", formData.enableSideMenuForAll);
            delete formData.enableSideMenuForAll;
        }
        if("displaySharedOnly" in formData){
            game.settings.set("token-variants", "displayOnlySharedImages", formData.displaySharedOnly);
            delete formData.displaySharedOnly;
        }
        if("disableSideMenuIfTHW" in formData){
            game.settings.set("token-variants", "disableSideMenuIfTHW", formData.disableSideMenuIfTHW);
            delete formData.disableSideMenuIfTHW;
        }
        game.settings.set("token-variants", "hudSettings", formData);
    }
}
