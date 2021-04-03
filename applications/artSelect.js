export default class ArtSelect extends FormApplication {
    constructor(buttons) {
        super({}, {});
        this.buttons = buttons;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "token-variants-art-select",
            classes: ["sheet"],
            template: "modules/token-variants/templates/artSelect.html",
            resizable: true,
            minimizable: false,
            title: "Variant Art Select Screen",
            width: 520
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
            html.find(`input#${index}`).on("click", () => {
                button.callback();
            });
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
