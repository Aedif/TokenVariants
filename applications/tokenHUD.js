import { getFileName, isImage, isVideo, SEARCH_TYPE} from "../scripts/utils.js"
import TokenConfig from "./tokenConfig.js";

function render(){
    
}


// not call if still caching
export async function renderHud(hud, html, token, searchText, doImageSearch, updateTokenImage, setActorImage) {
    console.log(searchText)
    const hudSettings = game.settings.get("token-variants", "hudSettings");

    if (!hudSettings.enableSideMenu) return;

    const search = searchText ? searchText : token.name;
    if (!search || search.length < 3) return;

    const userHasConfigRights = game.user && game.user.can("FILES_BROWSE") && game.user.can("TOKEN_CONFIGURE");

    let artSearch = await doImageSearch(search, {searchType: SEARCH_TYPE.TOKEN, ignoreKeywords: true});
    let images = artSearch ? artSearch.get(search) : new Map();

    let actorVariants = new Map();
    const tokenActor = game.actors.get(token.actorId);

    if (tokenActor) {
        actorVariants = tokenActor.getFlag('token-variants', 'variants') || [];

        // To maintain compatibility with previous versions
        if (!(actorVariants instanceof Array)){
            actorVariants = [];
        } else if (actorVariants.length != 0 && !(actorVariants[0] instanceof Object)){
            actorVariants.forEach((src, i) => {
                actorVariants[i] = {imgSrc: src, names: [getFileName(src)]};
            });
        } 
        // end of compatibility code

        // Merge images found through search with variants shared through 'variant' flag
        if (!searchText){
            actorVariants.forEach(variant => {
                for(let name of variant.names){
                    if(images.has(variant.imgSrc)){
                        if(!images.get(variant.imgSrc).includes(name))
                            images.get(variant.imgSrc).push(name);
                    } else {
                        images.set(variant.imgSrc, [name]);
                    }
                }
            });
        }
    }

    if (!hudSettings.alwaysShowButton && images.length < 2 && actorVariants.length == 0) return;

    // Retrieving the possibly custom name attached as a flag to the token
    let tokenImageName = "";
    if(token.flags["token-variants"] && token.flags["token-variants"]["name"]){
        tokenImageName = token.flags["token-variants"]["name"];
    } else {
        tokenImageName = getFileName(token.img);
    }

    let imagesParsed = [];
    images.forEach((names, tokenSrc) => {
        const img = isImage(tokenSrc);
        const vid = isVideo(tokenSrc);
        for(let name of names){
            let shared = false;
            if(userHasConfigRights){
                actorVariants.forEach(variant => {
                    if(variant.imgSrc === tokenSrc && variant.names.includes(name)) {
                        shared = true;
                    }
                });
            }
            imagesParsed.push({ route: tokenSrc, name: name, used: tokenSrc === token.img && name === tokenImageName, img, vid, type: img || vid, shared: shared }); 
        }  
    });

    // Render

    const imageDisplay = hudSettings.displayAsImage;
    const imageOpacity = hudSettings.imageOpacity / 100;

    const sideSelect = await renderTemplate('modules/token-variants/templates/sideSelect.html', { imagesParsed, imageDisplay, imageOpacity })

    const is080 = !isNewerVersion("0.8.0", game.data.version)

    let divR = html.find('div.right').append(sideSelect);

    // Activate listeners
    divR.find("#token-variants-side-button").click(_onSideButtonClick);
    divR.find(is080 ? '.control-icon[data-action="effects"] img' : 'div.control-icon.effects img').click(_onStatusEffectsClick);
    divR.find('.token-variants-button-select').click((event) => _onImageClick(event, token._id, updateTokenImage, setActorImage));
    divR.find('.token-variants-side-search').on('keyup', (event) => _onImageSearchKeyUp(event, hud, html, token, doImageSearch, updateTokenImage, setActorImage));
    if(userHasConfigRights) {
        divR.find("#token-variants-side-button").on("contextmenu", _onSideButtonRightClick);
        divR.find('.token-variants-button-select').on("contextmenu", (event) => _onImageRightClick(event, token._id));
    }

    // If renderHud is being called from text box search the side menu should be enabled by default
    if (searchText) {
        divR.find('#token-variants-side-button').parent().addClass('active');
        divR.find('.token-variants-wrap').addClass('active');
    }
}

function _onSideButtonClick(event){
    // De-activate 'Status Effects'
    const is080 = !isNewerVersion("0.8.0", game.data.version);
    const variantsControlIcon = $(event.target.parentElement);
    variantsControlIcon.closest('div.right').find( is080 ? '.control-icon[data-action="effects"]' : 'div.control-icon.effects').removeClass('active');
    variantsControlIcon.closest('div.right').find('.status-effects').removeClass('active');

    // Toggle variants side menu
    variantsControlIcon.toggleClass('active');
    const variantsWrap = variantsControlIcon.find('.token-variants-wrap');
    if(variantsControlIcon.hasClass('active')){
        variantsWrap.addClass('active');
    } else {
        variantsWrap.removeClass('active');
    }
}

function _onSideButtonRightClick(event){
    // Display side menu if button is not active yet
    const variantsControlIcon = $(event.target.parentElement);
    if(!variantsControlIcon.hasClass('active')){
        variantsControlIcon.find('img').trigger('click');
    }

    // Display/hide buttons and search input
    const sideSearch = $(event.target).closest('div.control-icon').find('.token-variants-side-search');
    const buttons = $(event.target).closest('div.control-icon').find('.token-variants-button-select');
    if(sideSearch.hasClass('active')){
        sideSearch.removeClass('active');
        buttons.removeClass('hide');
    } else {
        sideSearch.addClass('active');
        buttons.addClass('hide');
    }
}

function _onStatusEffectsClick(event){
    $(event.target).closest('div.right').find('.control-icon[data-action="token-variants-side-selector"]').removeClass('active');
    $(event.target).closest('div.right').find('.token-variants-wrap').removeClass('active');
}

function _onImageClick(event, tokenId, updateTokenImage, setActorImage){ //TODO
    event.preventDefault();
    event.stopPropagation();

    let token = canvas.tokens.controlled.find(t => t.data._id === tokenId)
    if(!token) return;
    else {
        const is080 = !isNewerVersion("0.8.0", game.data.version);
        token = is080 ? token.document : token;
    }

    const hudSettings = game.settings.get("token-variants", "hudSettings");
    const name = event.target.dataset.filename;
    const imgSrc = event.target.dataset.name;

    if(keyboard.isDown("Shift")){
        new TokenConfig(name, imgSrc, token.data).render(true);
    } else if(token.data.img === imgSrc){
        let tokenImageName = token.getFlag("token-variants", "name");
        if(!tokenImageName) tokenImageName = getFileName(token.data.img);
        if(tokenImageName !== name){
            updateTokenImage(null, token, imgSrc, name);
            canvas.tokens.hud.clear();
            if(token.actor && hudSettings.updateActorImage){
                setActorImage(game.actors.get(token.actor.id), imgSrc, name, {updateActorOnly: true});
            }
        }
    } else {
        updateTokenImage(null, token, imgSrc, name);
        if(token.actor && hudSettings.updateActorImage){
            setActorImage(game.actors.get(token.actor.id), imgSrc, name, {updateActorOnly: true});
        }
    }
}

function _onImageRightClick(event, tokenId){
    console.log(event)
    event.preventDefault();
    event.stopPropagation();

    let token = canvas.tokens.controlled.find(t => t.data._id === tokenId)
    if(!token) return;
    else {
        const is080 = !isNewerVersion("0.8.0", game.data.version);
        token = is080 ? token.document : token;
    }

    const imgSrc = event.target.dataset.name;
    const name = event.target.dataset.filename;

    if (token.actor) {
        let tokenActor = game.actors.get(token.actor.id);
        let variants = tokenActor.getFlag('token-variants', 'variants') || [];

        // To maintain compatibility with previous versions
        if (!(variants instanceof Array)){
            variants = [];
        } else if (variants.length != 0 && !(variants[0] instanceof Object)){
            variants.forEach((src, i) => {
                variants[i] = {imgSrc: src, names: [getFileName(src)]};
            });
        } 
        // end of compatibility code

        // Remove selected variant if present in the flag, add otherwise
        let del = false;
        let updated = false;
        for(let variant of variants){
            if(variant.imgSrc === imgSrc){
                let fNames = variant.names.filter(name => name !== name);
                if(fNames.length === 0){
                    del = true;
                } else if(fNames.length === variant.names.length){
                    fNames.push(name);
                }
                variant.names = fNames;
                updated = true;
                break;
            }
        }
        if(del) variants = variants.filter(variant => variant.imgSrc !== imgSrc);
        else if (!updated) variants.push({imgSrc: imgSrc, names: [name]});

        // Set shared variants as an actor flag
        tokenActor.unsetFlag('token-variants', 'variants');
        if(variants.length > 0){
            tokenActor.setFlag('token-variants', 'variants', variants);
        }
        $(event.target).parent().find('.fa-share').toggleClass('active'); // Display green arrow
    }
}

function _onImageSearchKeyUp(event, hud, html, tokenData, doImageSearch, updateTokenImage, setActorImage){
    if (event.key === 'Enter' || event.keyCode === 13) {
        if (event.target.value.length >= 3) {
            $(event.target).closest('.control-icon[data-action="token-variants-side-selector"]').remove();
            html.find('.control-icon[data-action="token-variants-side-selector"]').remove();
            renderHud(hud, html, tokenData, event.target.value, doImageSearch, updateTokenImage, setActorImage);
        }
    }
}