/**************************************************
* Overlay display manager                         *
* Author: Stephane Diemer                         *
* License: CC by SA v3                            *
* https://creativecommons.org/licenses/by-sa/3.0/ *
**************************************************/


function OverlayDisplayManager (options) {
    const allowedOptions = [
        'id',
        'language',
        'defaultButtonsClass',
        'overlaySelectorPlace',
        'hideOnEscape',
        'margin',
        'elementPadding',
        'topBarHeight',
        'bottomBarHeight',
        'zIndex'
    ];
    // params
    this.id = 1;
    this.language = 'en';
    this.defaultButtonsClass = '';
    this.overlaySelectorPlace = 'body';
    this.hideOnEscape = true;
    // size are in em unit
    this.margin = 2;
    this.elementPadding = 1;
    this.topBarHeight = 1.75;
    this.bottomBarHeight = 2;
    this.zIndex = null;

    // vars
    this.pendingShowParams = null;
    this.messages = {};
    this.widget = null;
    this.maxWidth = 0;
    this.maxHeight = 0;
    this.image = null;
    this.elementPlace = null;
    this.displayed = false;
    this.displayedElement = null;
    this.elementPaddingDisplayed = false;
    this.topBarDisplayed = false;
    this.bottomBarDisplayed = false;
    this.displayMode = null;
    this.title = '';
    this.resources = [];
    this.currentIndex = 0;
    this.currentResource = null;
    this.locked = false;
    this.noFixed = false;
    this.elementFirstFocused = null;
    this.lastFocus = null;
    this.ignoreUntilFocusChanges = false;

    if (window.jsu) {
        this.language = window.jsu.getCurrentLang();
    }
    if (options) {
        let attr;
        for (attr in options) {
            if (allowedOptions.indexOf(attr) < 0) {
                console.error('Unknown attribute given to OverlayDisplayManager: ' + attr);
            } else {
                this[attr] = options[attr];
            }
        }
    }
    this.setLanguage(this.language);
    // see if DOM is already available
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // call on next available tick
        setTimeout(this._init.bind(this), 1);
    } else {
        document.addEventListener('DOMContentLoaded', this._init.bind(this));
    }
    window.addEventListener('resize', this.onResize.bind(this));
}
OverlayDisplayManager.version = 2;

OverlayDisplayManager.prototype._init = function () {
    if (!isNaN(this.id)) {
        if (window.odmIdCount) {
            window.odmIdCount++;
            this.id = window.odmIdCount;
        } else {
            window.odmIdCount = 1;
            this.id = 1;
        }
    }
    let extraClass = '';
    if (this.overlaySelectorPlace != 'body' || navigator.platform == 'iPad' || navigator.platform == 'iPhone' || navigator.platform == 'iPod') {
        this.noFixed = true;
        extraClass = 'no-fixed';
    }
    this.widget = document.createElement('div');
    this.widget.setAttribute('id', 'odm_' + this.id);
    this.widget.setAttribute('class', 'odm-main ' + extraClass);
    if (this.zIndex) {
        this.widget.setAttribute('style', 'z-index:' + this.zIndex);
    }
    this.widget.innerHTML = '<div class="odm-layer" tabindex="0">' +
        '<table class="odm-table" role="presentation"><tr class="odm-table"><td class="odm-table">' +
            '<div role="dialog" tabindex="-1" aria-labelledby="odm_title_' + this.id + '" aria-modal="true" class="odm-block">' +
                '<button type="button" class="odm-close" title="' + this.messages.close + '" aria-label="' + this.messages.close + '">' +
                    '<i aria-hidden="true">X</i></button>' +
                '<div class="odm-top-bar">' +
                    '<div class="odm-resources"></div>' +
                    '<h1 id="odm_title_' + this.id + '" class="odm-title"></h1>' +
                '</div>' +
                '<div class="odm-element-place">' +
                    '<div class="odm-element-content"></div>' +
                    '<div class="odm-hover-loading"><div>' + this.messages.loading + '</div></div>' +
                '</div>' +
                '<div class="odm-bottom-bar">' +
                    '<div class="odm-buttons"></div>' +
                '</div>' +
                '<button type="button" class="odm-previous"><span>' +
                    '<i>←</i><b>' + this.messages.previous + '</b></span></button>' +
                '<button type="button" class="odm-next"><span>' +
                    '<i>→</i><b>' + this.messages.next + '</b></span></button>' +
            '</div>' +
        '</td></tr></table>' +
    '</div>' +
    '<div class="odm-closer" tabindex="0"></div>';
    document.querySelector(this.overlaySelectorPlace).appendChild(this.widget);
    this.elementPlace = this.widget.querySelector('.odm-element-content');

    // bind events
    const obj = this;
    this.widget.querySelector('.odm-previous').addEventListener('click', function () {
        obj.previous();
    });
    this.widget.querySelector('.odm-next').addEventListener('click', function () {
        obj.next();
    });
    this.widget.querySelector('.odm-close').addEventListener('click', function () {
        if (!obj.locked) {
            obj.hide();
        }
    });
    this.widget.querySelector('.odm-closer').addEventListener('click', function () {
        if (!obj.locked) {
            obj.hide();
        }
    });
    this.widget.querySelector('.odm-element-content').addEventListener('click', function () {
        if (!obj.locked && obj.displayMode == 'image' && obj.resources.length < 2 && obj.image && !obj.image.loadingFailed) {
            obj.hide();
        }
    });
    window.addEventListener('keydown', function (event) {
        if (!obj.displayed) {
            return;
        }
        switch (event.keyCode) {
            case 27:
                if (!obj.locked && obj.hideOnEscape) {
                    event.stopImmediatePropagation();
                    obj.hide();
                }
                break;
            case 37:
                event.stopImmediatePropagation();
                obj.previous();
                break;
            case 39:
                event.stopImmediatePropagation();
                obj.next();
                break;
        }
    });
    this.onResize();
    if (this.pendingShowParams) {
        this.show(this.pendingShowParams);
    }
};
OverlayDisplayManager.prototype.trapFocus = function (event) {
    if (this.ignoreUntilFocusChanges) {
        return;
    }
    if (this.widget.querySelector('.odm-block').contains(event.target)) {
        this.lastFocus = event.target;
    } else {
        this.focusFirstDescendant(this.widget.querySelector('.odm-block'));
        if (this.lastFocus == document.activeElement) {
            this.focusLastDescendant(this.widget.querySelector('.odm-block'));
        }
        this.lastFocus = document.activeElement;
    }
};
OverlayDisplayManager.prototype.focusLastDescendant = function (element) {
    for (let i = element.childNodes.length - 1; i >= 0; i--) {
        const child = element.childNodes[i];
        if (this.attemptFocus(child) || this.focusLastDescendant(child)) {
            return true;
        }
    }
    return false;
};
OverlayDisplayManager.prototype.focusFirstDescendant = function (element) {
    for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes[i];
        if (this.attemptFocus(child) || this.focusFirstDescendant(child)) {
            return true;
        }
    }
    return false;
};
OverlayDisplayManager.prototype.attemptFocus = function (element) {
    if (!this.isFocusable(element)) {
        return false;
    }

    this.ignoreUntilFocusChanges = true;
    try {
        element.focus();
    } catch (e) {
        console.error('Failed to focus last element.', e);
    }
    this.ignoreUntilFocusChanges = false;
    return (document.activeElement === element);
};


OverlayDisplayManager.prototype.isFocusable = function (element) {
    if (element.tabIndex > 0 || (element.tabIndex === 0 && element.getAttribute('tabIndex') !== null)) {
        return true;
    }

    if (element.disabled) {
        return false;
    }

    switch (element.nodeName) {
        case 'A':
            return !!element.href && element.rel != 'ignore';
        case 'INPUT':
            return element.type != 'hidden' && element.type != 'file';
        case 'BUTTON':
        case 'SELECT':
        case 'TEXTAREA':
            return true;
        default:
            return false;
    }
};

OverlayDisplayManager.prototype.setLanguage = function (lang) {
    if (lang == 'fr') {
        this.language = 'fr';
        this.messages = {
            close: 'Fermer',
            loading: 'Chargement...',
            notFound: 'Image introuvable',
            unknownResource: 'Type de ressource inconnu',
            previous: 'Pr&eacute;c&eacute;dent',
            next: 'Suivant'
        };
    } else {
        this.language = 'en';
        this.messages = {
            close: 'Close',
            loading: 'Loading...',
            notFound: 'Image not found',
            unknownResource: 'Unknown resource type',
            previous: 'Previous',
            next: 'Next'
        };
    }
    if (this.widget) {
        // replace messages
        this.widget.querySelector('.odm-close').setAttribute('title', this.messages.close);
        this.widget.querySelector('.odm-close').setAttribute('aria-label', this.messages.close);
        this.widget.querySelector('.odm-hover-loading div').innerHTML = this.messages.loading;
        this.widget.querySelector('.odm-previous b').innerHTML = this.messages.previous;
        this.widget.querySelector('.odm-next b').innerHTML = this.messages.next;
    }
};

OverlayDisplayManager.prototype.onResize = function () {
    let dpEle;
    if (this.displayedElement && this.displayedElement.parentElement == this.elementPlace) {
        dpEle = this.displayedElement;
    }
    let emFactor = 15;
    if (dpEle) {
        try {
            // get number of px of one em
            const fontSize = window.getComputedStyle(dpEle).getPropertyValue('fontSize');
            if (fontSize.indexOf('px') > 0) {
                emFactor = parseFloat(fontSize.replace(/[^0-9.]+/g,''));
            }
        } catch (e) {
            // ignore error and use default value
        }
    }
    const widthUsed = this.margin;
    let heightUsed = this.margin;
    if (this.topBarDisplayed) {
        heightUsed += this.topBarHeight;
    }
    if (this.bottomBarDisplayed) {
        heightUsed += this.bottomBarHeight;
    }
    if (this.overlaySelectorPlace != 'body') {
        const placeEle = document.querySelector(this.overlaySelectorPlace);
        this.maxWidth = placeEle.offsetWidth - (widthUsed * emFactor);
        this.maxHeight = placeEle.offsetHeight - (heightUsed * emFactor);
    } else {
        this.maxWidth = window.innerWidth - (widthUsed * emFactor);
        this.maxHeight = window.innerHeight - (heightUsed * emFactor);
    }
    const padding = this.elementPaddingDisplayed ? this.elementPadding * emFactor : 0;
    if (dpEle) {
        if (this.maxWidth > 0) {
            dpEle.style.setProperty('max-width', (this.maxWidth - padding) + 'px');
        }
        if (this.maxHeight > 0) {
            dpEle.style.setProperty('max-height', (this.maxHeight - padding) + 'px');
        }
    }
};

OverlayDisplayManager.prototype._setResources = function (params) {
    // reset content
    if (this.widget && !this.displayed) {
        this.loadingDisplayed = true;
        const loadingEle = document.createElement('div');
        loadingEle.setAttribute('class', 'odm-element odm-loading');
        loadingEle.innerHTML = this.messages.loading;
        this._displayElement(loadingEle);
        this.image = null;
        this.currentResource = null;
    }
    // parse resources
    this.resources = [];
    if (typeof params != 'string' && params.length !== undefined) {
        for (let i = 0; i < params.length; i++) {
            this._addResources(params[i]);
        }
    } else {
        this._addResources(params);
    }
    // display require elements
    this.currentIndex = 0;
    if (this.resources.length < 1) {
        return;
    }
    if (this.resources.length > 1) {
        if (params.index && params.index > 0 && params.index < params.length) {
            this.currentIndex = params.index;
        }
        if (this.widget) {
            this.widget.querySelector('.odm-resources').innerHTML = (this.currentIndex + 1) + ' / ' + this.resources.length;
            if (!this.topBarDisplayed) {
                this.topBarDisplayed = true;
                this.widget.classList.add('odm-top-bar-displayed');
                this.onResize();
            }
            if (this.currentIndex > 0) {
                this.widget.querySelector('.odm-previous').style.setProperty('display', 'block');
            } else {
                this.widget.querySelector('.odm-previous').style.setProperty('display', 'none');
            }
            if (this.currentIndex < this.resources.length - 1) {
                this.widget.querySelector('.odm-next').style.setProperty('display', 'block');
            } else {
                this.widget.querySelector('.odm-next').style.setProperty('display', 'none');
            }
        }
    } else {
        if (this.widget) {
            if (this.topBarDisplayed && !this.title) {
                this.topBarDisplayed = false;
                this.widget.classList.remove('odm-top-bar-displayed');
                this.onResize();
            }
            this.widget.querySelector('.odm-resources').innerHTML = '';
            this.widget.querySelector('.odm-previous').style.setProperty('display', 'none');
            this.widget.querySelector('.odm-next').style.setProperty('display', 'none');
        }
    }
    return this.resources[this.currentIndex];
};

OverlayDisplayManager.prototype._addResources = function (res) {
    if (typeof res == 'string') {
        this.resources.push({ image: res });
    } else {
        this.resources.push(res);
    }
};

OverlayDisplayManager.prototype._checkTitleDisplay = function (title) {
    if (this.title == title) {
        return;
    }

    this.widget.querySelector('.odm-title').innerHTML = title;
    this.title = title;
    const shouldDisplay = title || this.resources.length > 1;
    if (shouldDisplay && !this.topBarDisplayed) {
        this.topBarDisplayed = true;
        this.widget.classList.add('odm-top-bar-displayed');
        this.onResize();
    } else if (!shouldDisplay && this.topBarDisplayed) {
        this.topBarDisplayed = false;
        this.widget.classList.remove('odm-top-bar-displayed');
        this.onResize();
    }
};

OverlayDisplayManager.prototype._checkButtonsDisplay = function (resource) {
    const btns = resource.buttons;
    if (btns) {
        // update buttons
        if (!btns.loaded) {
            this.widget.querySelector('.odm-buttons').innerHTML = '';
            for (let i = 0; i < btns.length; i++) {
                const btn = document.createElement('button');
                btn.setAttribute('type', 'button');
                btn.innerHTML = btns[i].label;
                if (btns[i].id) {
                    btn.setAttribute('id', btns[i].id);
                }
                if (btns[i].disabled) {
                    btn.setAttribute('disabled', 'disabled');
                }
                if (btns[i].klass) {
                    btn.setAttribute('class', this.defaultButtonsClass + ' ' + btns[i].klass);
                } else {
                    btn.setAttribute('class', this.defaultButtonsClass);
                }
                if (btns[i].callback) {
                    const callback = btns[i].callback;
                    const data = btns[i].data ? btns[i].data : {};
                    data.odm = this;
                    btn.addEventListener('click', function (event) {
                        callback(event, data);
                    });
                }
                if (btns[i].close) {
                    btn.addEventListener('click', this.hide.bind(this));
                }
                this.widget.querySelector('.odm-buttons').appendChild(btn);
            }
            btns.loaded = true;
        }
        // show bottom bar
        if (!this.bottomBarDisplayed) {
            this.widget.classList.add('odm-bottom-bar-displayed');
            this.bottomBarDisplayed = true;
            this.onResize();
        }
        if (!this.focusFirstDescendant(this.widget.querySelector('.odm-element-content'))) {
            // if no focusable element is in content, try to focus any button in the top block
            this.focusFirstDescendant(this.widget.querySelector('.odm-block'));
        }
    } else if (this.bottomBarDisplayed) {
        // hide bottom bar and clear buttons
        this.widget.classList.remove('odm-bottom-bar-displayed');
        this.bottomBarDisplayed = false;
        this.widget.querySelector('.odm-buttons').innerHTML = '';
        this.onResize();
    }
};

OverlayDisplayManager.prototype._setLocked = function (locked) {
    if (this.locked == locked) {
        return;
    }

    this.locked = locked;
    const display = this.locked ? 'none' : '';
    this.widget.querySelector('.odm-close').style.setProperty('display', display);
};


OverlayDisplayManager.prototype._onResourceHide = function () {
    if (this.currentResource && this.currentResource.onHide) {
        this.currentResource.onHide();
        // Don't call onHide twice
        delete this.currentResource.onHide;
    }
};
OverlayDisplayManager.prototype._loadResource = function (resource) {
    this._onResourceHide();

    this._checkTitleDisplay(resource.title ? resource.title : '');
    this._checkButtonsDisplay(resource);
    this._setLocked(Boolean(resource.locked));

    this.currentResource = resource;
    if (resource.image) {
        // image mode
        this._loadImage(resource);
    } else if (resource.iframe) {
        // iframe mode
        this._loadIframe(resource);
    } else if (resource.html) {
        // html mode
        this._loadHTML(resource);
    } else {
        this._displayError('unknownResource');
    }
};

// Main functions
OverlayDisplayManager.prototype.change = function (params) {
    if (!params) {
        return;
    }

    const resource = this._setResources(params);
    if (this.displayed) {
        this._loadResource(resource);
    }
};
OverlayDisplayManager.prototype.show = function (params) {
    if (!this.widget) {
        this.pendingShowParams = params;
        return;
    }
    this.pendingShowParams = null;
    if (this.displayed) {
        return this.change(params);
    }

    this.elementFirstFocused = document.activeElement;
    let resource;
    if (params) {
        resource = this._setResources(params);
    } else if (this.resources.length < 1) {
        return;
    } else if (!this.currentResource) {
        resource = this.resources[this.currentIndex];
    }
    if (resource) {
        this._loadResource(resource);
    } else {
        this._refreshElement();
    }
    if (this.noFixed) {
        const scrollY = window.scrollY !== undefined ? window.scrollY : 0;
        this.widget.querySelector('.odm-table').style.setProperty('margin-top', (scrollY + 10) + 'px');
    }
    this.displayed = true;
    this.widget.style.setProperty('opacity', '0');
    this.widget.style.setProperty('display', 'block');
    this.widget.style.setProperty('opacity', '');
    const obj = this;
    setTimeout(function () {
        // wait for transition to end
        obj.lastFocus = document.activeElement;
        obj.widget.addEventListener('focus', obj.trapFocus.bind(obj), true);
        if (!obj.focusFirstDescendant(obj.widget.querySelector('.odm-element-content'))) {
            // if no focusable element is in content, try to focus any button in the top block
            obj.focusFirstDescendant(obj.widget.querySelector('.odm-block'));
        }
    }, 300);
};
OverlayDisplayManager.prototype.hide = function () {
    if (this.pendingShowParams) {
        this.pendingShowParams = null;
    }
    if (!this.displayed) {
        return;
    }

    this.displayed = false;
    this.widget.style.setProperty('opacity', '0');
    const obj = this;
    setTimeout(function () {
        // wait for transition to end
        if (obj.displayed) {
            // show was called during timeout
            return;
        }
        obj.widget.style.setProperty('display', '');
        obj._onResourceHide();
        if (obj.elementFirstFocused) {
            obj.attemptFocus(obj.elementFirstFocused);
        }
        obj.widget.removeEventListener('focus', obj.trapFocus, true);
        obj.lastFocus = document.activeElement;
    }, 300);
};

// Resources list functions
OverlayDisplayManager.prototype.goToIndex = function (index) {
    if (index >= this.resources.length || index < 0) {
        return;
    }

    this.widget.querySelector('.odm-resources').innerHTML = (index + 1) + ' / ' + this.resources.length;
    if (index > 0) {
        this.widget.querySelector('.odm-previous').style.setProperty('display', 'block');
    } else {
        this.widget.querySelector('.odm-previous').style.setProperty('display', '');
    }
    if (index < this.resources.length - 1) {
        this.widget.querySelector('.odm-next').style.setProperty('display', 'block');
    } else {
        this.widget.querySelector('.odm-next').style.setProperty('display', '');
    }
    if (this.currentIndex != index) {
        this.currentIndex = index;
        this._loadResource(this.resources[this.currentIndex]);
    }
};
OverlayDisplayManager.prototype.next = function () {
    if (this.resources.length > 0 && this.currentIndex + 1 < this.resources.length) {
        this.goToIndex(this.currentIndex + 1);
    }
};
OverlayDisplayManager.prototype.previous = function () {
    if (this.resources.length > 0 && this.currentIndex - 1 >= 0) {
        this.goToIndex(this.currentIndex - 1);
    }
};

// Element display
OverlayDisplayManager.prototype._displayElement = function (element, padding) {
    const elementPlace = this.elementPlace;
    // hide previous element
    if (this.displayedElement && this.displayedElement != element) {
        const previous = this.displayedElement;
        const hidePrevious = function () {
            if (previous.parentElement == elementPlace) {
                previous.parentElement.removeChild(previous);
            }
            previous.style.setProperty('opacity', '');
            previous.style.setProperty('position', '');
            previous.classList.remove('odm-element');
        };
        if (!this.displayed || previous.classList.contains('odm-loading') || previous.classList.contains('odm-error')) {
            hidePrevious();
        } else {
            previous.style.setProperty('opacity', '0');
            previous.style.setProperty('position', 'absolute');
            setTimeout(hidePrevious, 300);
        }
    }
    // show new element
    this.elementPaddingDisplayed = Boolean(padding);
    this.displayedElement = element;
    if (element && element.parentElement != elementPlace) {
        elementPlace.appendChild(element);
    }
};
OverlayDisplayManager.prototype._refreshElement = function () {
    this._displayElement(this.displayedElement, this.elementPaddingDisplayed);
};

// Error and loading management
OverlayDisplayManager.prototype._displayError = function (msg) {
    const msgEle = document.createElement('div');
    msgEle.innerHTML = '<div class="odm-element odm-error">' + ((msg in this.messages) ? this.messages[msg] : msg) + '</div>';
    this._displayElement(msgEle);
};
OverlayDisplayManager.prototype._showLoading = function () {
    if (this.loadingDisplayed) {
        return;
    }
    this.loadingDisplayed = true;
    if (this.loadingTimeoutId !== null) {
        clearTimeout(this.loadingTimeoutId);
        this.loadingTimeoutId = null;
    }
    const obj = this;
    this.loadingTimeoutId = setTimeout(function () {
        obj.widget.classList.add('odm-hover-loading-displayed');
    }, 300);
};
OverlayDisplayManager.prototype._hideLoading = function () {
    if (!this.loadingDisplayed) {
        return;
    }
    this.loadingDisplayed = false;
    if (this.loadingTimeoutId !== null) {
        clearTimeout(this.loadingTimeoutId);
        this.loadingTimeoutId = null;
    }
    this.widget.classList.remove('odm-hover-loading-displayed');
};

// Image management
OverlayDisplayManager.prototype._loadImage = function (resource, callback) {
    if (this.displayMode != 'image') {
        this.displayMode = 'image';
        // show loading element
        this.loadingDisplayed = true;
        const loadingEle = document.createElement('div');
        loadingEle.setAttribute('class', 'odm-element odm-loading');
        loadingEle.innerHTML = this.messages.loading;
        this._displayElement(loadingEle);
    } else if (this.image && this.image.oriSrc == resource.image) {
        if (callback) {
            callback(Boolean(this.image.loadingFailed));
        }
        return;
    }

    this.image = new Image();
    this.image.odm = this;
    this.image.odmCallback = callback;
    const alt = resource.alt || '';
    this._showLoading();
    this.image.onload = function () {
        const imgEle = document.createElement('img');
        imgEle.setAttribute('class', 'odm-element');
        imgEle.setAttribute('alt', alt);
        imgEle.setAttribute('src', this.src);
        imgEle.setAttribute('style', 'max-width: ' + this.odm.maxWidth + 'px; max-height: ' + this.odm.maxHeight + 'px;');
        this.odm._hideLoading();
        this.odm._displayElement(imgEle);
        if (this.odmCallback) {
            this.odmCallback(true);
        }
    };
    this.image.onabort = this.image.onload;
    this.image.onerror = function () {
        this.loadingFailed = true;
        this.odm._hideLoading();
        this.odm._displayError('notFound');
        if (this.odmCallback) {
            this.odmCallback(false);
        }
    };
    this.image.oriSrc = resource.image;
    this.image.src = resource.image;
};

// Iframe management
OverlayDisplayManager.prototype._loadIframe = function (resource, callback) {
    if (this.displayMode != 'iframe') {
        this.displayMode = 'iframe';
    }
    const width = resource.width ? resource.width : this.maxWidth + 'px';
    const height = resource.height ? resource.height : this.maxHeight + 'px';
    const ifrEle = document.createElement('iframe');
    ifrEle.setAttribute('class', 'odm-element');
    ifrEle.setAttribute('src', resource.iframe);
    ifrEle.setAttribute('style', 'width: ' + width + '; height: ' + height + ';');
    this._displayElement(ifrEle);
    if (callback) {
        callback(true);
    }
};

// HTML management
OverlayDisplayManager.prototype._loadHTML = function (resource, callback) {
    if (this.displayMode != 'html') {
        this.displayMode = 'html';
    }
    let htEle;
    if (typeof resource.html === 'string') {
        htEle = document.createElement('div');
        htEle.innerHTML = resource.html;
    } else {
        if ('detach' in resource.html) {
            // jquery element
            htEle = resource.html[0];
        } else {
            htEle = resource.html;
        }
        if (htEle.parentElement) {
            htEle.parentElement.removeChild(htEle);
        }
    }
    htEle.classList.add('odm-element');
    htEle.style.setProperty('max-width', (this.maxWidth - this.elementPadding) + 'px');
    htEle.style.setProperty('max-height', (this.maxHeight - this.elementPadding) + 'px');
    htEle.style.setProperty('opacity', '');
    htEle.style.setProperty('position', '');
    this._displayElement(htEle, true);
    if (callback) {
        callback(true);
    }
};
