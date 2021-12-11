export default class RandomizerSettings extends FormApplication {

    constructor() {
        super({}, {title: `Randomizer settings`});
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "token-variants-randomizer-settings",
            classes: ["sheet"],
            template: "modules/token-variants/templates/randomizerSettings.html",
            resizable: false,
            minimizable: false,
            closeOnSubmit: true,
            width: 480,
            height: "auto",
            dragDrop: [{dragSelector: null, dropSelector: null}]
        });
    }

    async getData(options) {
        const data = super.getData(options);
        return mergeObject(data, game.settings.get("token-variants", "randomizerSettings"));
    }

    async _updateObject(event, formData) {
        game.settings.set("token-variants", "randomizerSettings", formData);
    }
}
