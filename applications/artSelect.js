function getStartingWidth(allImages) {
    let maxLength = 0;
    if (allImages)
        allImages.forEach((tokens, _) => {
            if (maxLength < tokens.length)
                maxLength = tokens.length;
        });
    return maxLength < 4 ? 150 * maxLength + 30 : 550;
}

function getStartingHeight(allImages) {
    let maxRows = 0;
    let maxLength = 0;
    if (allImages)
        allImages.forEach((tokens, _) => {
            maxRows++;
            if (maxLength < tokens.length)
                maxLength = tokens.length;
        });
    if (maxRows > 2) return 500;
    if (maxLength > 8) return 500;
    return undefined;
}

export default class ArtSelect extends FormApplication {
    constructor(title, search, allImages, callback, performSearch) {
        super({}, { closeOnSubmit: false, width: getStartingWidth(allImages), height: getStartingHeight(allImages), title: title });
        this.search = search;
        this.allImages = allImages;
        this.callback = callback;
        this.performSearch = performSearch;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "token-variants-art-select",
            classes: ["sheet"],
            template: "modules/token-variants/templates/artSelect.html",
            resizable: true,
            minimizable: false,
        });
    }

    async getData(options) {
        const data = super.getData(options);
        data.allImages = this.allImages;
        data.search = this.search;
        return data;
    }

    /**
     * @param {JQuery} html
     */
    activateListeners(html) {
        super.activateListeners(html);
        const callback = this.callback;
        const close = () => this.close();

        const boxes = html.find(`.token-variants-box`);
        boxes.map((box) => {
            boxes[box].addEventListener('click', function (event) {
                callback(event.target.dataset.name);
                close();
            })
        });

        html.find(`button#custom-art-search-bt`).on("click", (() => {
            this.performSearch(html.find(`input#custom-art-search`)[0].value);
        }));
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
