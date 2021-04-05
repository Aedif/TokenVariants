export default class ArtSelect extends FormApplication {
    constructor(buttons) {
        super({}, { width: buttons.length < 4 ? 150 * buttons.length + 30 : 550 });
        this.buttons = buttons;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "token-variants-art-select",
            classes: ["sheet"],
            template: "modules/token-variants/templates/artSelect.html",
            resizable: true,
            minimizable: false,
            title: game.i18n.localize("token-variants.SelectScreenTitle"),
        });
    }

    async getData(options) {
        const data = super.getData(options);
        data.buttons = this.buttons;
        return data;
    }

    /**
     * @param {JQuery} html
     */
    activateListeners(html) {
        super.activateListeners(html);
        this.buttons.forEach((button, index) => {
            html.find(`input#${index}`).on("click", button.callback);
        });
    }

    /**
     * @param {Event} event
     * @param {Object} formData
     */
    async _updateObject(event, formData) {
        this.close();
    }
}
