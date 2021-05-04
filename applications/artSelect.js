function getStartingWidth(allButtons) {
    let maxLength = 0;
    for (let k in allButtons) {
        if (maxLength < allButtons[k].length) {
            maxLength = allButtons[k].length;
        }
    }
    return maxLength < 4 ? 150 * maxLength + 30 : 550;
}

function getStartingHeight(allButtons) {
    let maxRows = 0;
    let maxLength = 0;
    for (let k in allButtons) {
        maxRows++;
        if (maxLength < allButtons[k].length) {
            maxLength = allButtons[k].length;
        }
    }
    if (maxRows > 2) return 500;
    if (maxLength > 8) return 500;
    return undefined;
}

export default class ArtSelect extends FormApplication {
    constructor(allButtons, search, performSearch) {
        super({}, { closeOnSubmit: false, width: getStartingWidth(allButtons), height: getStartingHeight(allButtons) });
        this.allButtons = allButtons;
        this.search = search;
        this.performSearch = performSearch;
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
        data.allButtons = this.allButtons;
        data.search = this.search;
        return data;
    }

    /**
     * @param {JQuery} html
     */
    activateListeners(html) {
        super.activateListeners(html);
        for (let k in this.allButtons) {
            for (let button of this.allButtons[k]) {
                html.find(`input#${button.id}`).on("click", () => {
                    button.callback();
                });
            }
        }

        html.find(`button#custom-art-search-bt`).on("click", () => {
            this.performSearch(html.find(`input#custom-art-search`)[0].value);
        });
    }

    /**
     * @param {Event} event
     * @param {Object} formData
     */
    async _updateObject(event, formData) {
        if (formData && formData.search != this.search) {
            this.performSearch(formData.search);
        } else {
            this.close();
        }
    }
}
