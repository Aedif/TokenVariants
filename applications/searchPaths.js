function getPaths(){
    let paths = game.settings.get("token-variants", "searchPaths");

    // To maintain compatibility with previous versions
    const defaultCaching = !game.settings.get("token-variants", "disableCaching");
    if(paths.length > 0 && !(paths[0] instanceof Object)){
        paths.forEach((path, i) => {
            paths[i] = {text: path, cache: defaultCaching};
        });
    }
    // end of compatibility code

    return paths;
}

export default class SearchPaths extends FormApplication {

    constructor() {
        super({paths: getPaths()}, {});
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "token-variants-search-paths",
            classes: ["sheet"],
            template: "modules/token-variants/templates/searchPaths.html",
            resizable: true,
            minimizable: false,
            closeOnSubmit: false,
            title: "Search Paths",
            width: 500,
            height: "auto",
            scrollY: ["ol.table-paths"],
            dragDrop: [{dragSelector: null, dropSelector: null}]
        });
    }

    async getData(options) {
        const paths = this.object.paths.map(path => {
            const r = {};
            r.text = path.text;
            r.type = this._determineType(path.text);
            r.cache = path.cache;
            return r;
        });

        const data = super.getData(options);
        data.paths = paths;
        return data;
    }

    _determineType(path){
        const regexpForge = /(.*assets\.forge\-vtt\.com\/)(\w+)\/(.*)/;

        if (path.startsWith("s3:")) {
            return "s3";
        }else if (path.startsWith("rolltable:")) {
            return "rolltable";
        } else if(path.match(regexpForge)){
            return "forge"
        }

        return "local"
    }

    /**
     * @param {JQuery} html
     */
    activateListeners(html) {
        super.activateListeners(html);
        html.find("a.create-path").click(this._onCreatePath.bind(this));
        html.find("a.delete-path").click(this._onDeletePath.bind(this));
        html.find("button.reset").click(this._onReset.bind(this));
        html.find("button.update").click(this._onUpdate.bind(this));
        html.on("input", "[type=text]", this._onTextChange.bind(this))
    }

    async _onTextChange(event){        
        const type = this._determineType(event.target.value);
        let image = "fas fa-folder";
        if(type === "rolltable"){
            image= "fas fa-dice";
        } else if (type === "s3"){
            image = "fas fa-database";
        } else if (type === "forge"){
            image = "fas fa-hammer";
        }

        $(event.currentTarget).closest(".table-path").find(".path-image i").attr('class', image);
    }

    async _onCreatePath(event){
        event.preventDefault();
        await this._onSubmit(event);

        this.object.paths.push({text: "", cache: true})
        this.render();
    }

    async _onDeletePath(event){
        event.preventDefault();
        await this._onSubmit(event);

        const li = event.currentTarget.closest(".table-path");
        this.object.paths.splice(li.dataset.index, 1);
        this.render();
    }

    _onReset(event){
        event.preventDefault();
        this.object.paths = getPaths();
        this.render();
    }

    async _onUpdate(event){
        event.preventDefault();
        await this._onSubmit(event);
        game.settings.set("token-variants", "searchPaths", this.object.paths.filter(path => Boolean(path.text)));
    }

    async _updateObject(event, formData) {
        const expanded = foundry.utils.expandObject(formData);
        expanded.paths = expanded.hasOwnProperty("paths") ? Object.values(expanded.paths) : [];
        expanded.paths.forEach((path, index)=> {
            this.object.paths[index] = {
                text: path.text,
                cache: path.cache
            };
        });
    }

    async close(options={}) {
        await this._onSubmit(event);
        game.settings.set("token-variants", "searchPaths", this.object.paths.filter(path => Boolean(path.text)))
        return super.close(options)
    }
}
