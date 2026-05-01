/**
 * Copyright (c) 2019, Sönke Fischer
 *
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.txt', which is part of this source code package.
 *
 * javascript file that provides core converter functionality
 * (like getParts() and translateParts() ...)
 *
 */


'use strict';

/* *****************************************************
 * These variables need to be defined here or elsewhere
 *
 * const tabFileName = 'data/translationTable.csv';
 *
 * //                        true/on false/off
 * const variationSwitch = [ "with", "without"];
 *
 * // some default values
 * let defaultInput = ["abc"];
 *
 * let defaultSrcSystem = 0;
 * let defaultDstSystem = 1;
 * let debugMode = false;
 *
 * let bracketPartDetection = false;
 *
 * // filter of translations
 * let removeLongSrcParts = true;
 * let removeDuplicateDstParts = true;
 * let removeSmallerDstParts = true;
 *
 *******************************************************/

/**
 * array that will be filled with content of translation table
 * @type Array
 */
const tab = [];

/**
 * array that will be filled with content of translation table
 * or content of corresponding picker layout file
 * @type Array
 */
const picker = [];

/**
 * for simpler/faster determination of amount of available systems
 * @type Number
 */
let amountOfSystems = 0;

/**
 * Array that will be filled with all system names
 * for simpler/faster name/id-translation
 * @type Array
 */
let systemNames = [];

/**
 * array that will be filled with font names for each system
 * each system can have its own font
 * @type Array
 */
let fontNames = [];

// systems should be setable by basic name of a system + a set of variations
const baseSystemNames = [];
const variationNames = [];

/**
 * Array that will be filled with information about available
 * combinations of base system and possible variations, since
 * not all basic systems have all possible variations
 * @type Array
 */
const variationPossibilities = [];

/**
 * Array that will hold all possible parts of input
 * @type Array
 */
const collectedParts = [];

/**
 * Array that will hold all possible translations of possible parts of input
 * @type Array
 */
const translatedParts = [];

/**
 * Object that holds some interesting values of selected destination system
 * @type object
 */
let selectedDstSystem = {
    id: null,
    name: null,
    baseName: null,
    variations: null
};

/**
 * Object that holds some interesting values of selected source system
 * @type object
 */
let selectedSrcSystem = {
    id: null,
    name: null,
    baseName: null,
    variations: null
};

function init(func) {
    init_tab(func);
}

/**
 * we need to get all relevant data from "external" files before
 * we can do the rest
 *
 * since calling open() synchronously is considered deprecated
 * we call relevant functions after file was successfully loaded and
 * content filled in ...
 *
 * @param {function} func - function that will be passed to next init-function
 */
function init_tab(func) {

    let xhr = new XMLHttpRequest();

    xhr.overrideMimeType("text/plain");

    function error() {
        window.alert("Error while loading translation table file " + tabFileName + " !");
    }

    xhr.onerror = error;

    // with chromium and local files use '--allow-file-access-from-files'

    xhr.open("GET", tabFileName, true);

    xhr.onload = function () {
        if (xhr.status !== 200 && xhr.status !== 0) {
            error();
            return;
        }
        let txt = xhr.response;
        if (txt != null && txt !== "") {

            // split input on linebreaks
            let lines = txt.split(/\r?\n/);

            // check result
            if (lines.length <= 0) {
                console.log("Error: translation table file has to few lines!");
                error();
                return;
            }

            let symbols;
            let x, y;

            let allLinesEmpty = true;

            let amountOfFields = -1;

            // first collect all possible base system names and variations
            for (x = 0; x < lines.length; x++) {
                if (lines[x].length > 0) {

                    // irgnore comment lines
                    if (/^#/.test(lines[x])) {
                        continue;
                    }

                    allLinesEmpty = false;

                    // splitting on commas, but not commas inside "" or ''
                    symbols = lines[x].split(/,(?![^"]*"(?:(?:[^"]*"){2})*[^"]*$)/);

                    // check result
                    if (amountOfFields === -1) {
                        amountOfFields = symbols.length;
                    }

                    if (symbols.length !== amountOfFields) {
                        console.log("Error: lines in translation table file have different amounts of fields!");
                        error();
                        return;
                    }

                    if (symbols.length <= 4 || typeof symbols[0] === 'undefined' ||
                        typeof symbols[1] === 'undefined' ||
                        typeof symbols[3] === 'undefined') {
                        console.log("Error: translation table file contains malformatted lines!");
                        error();
                        return;
                    }

                    // first two symbols contain base system name
                    // i.e. IPA,Kiel
                    let n = symbols[0] + symbols[1];

                    // be sure names are non-empty and only contain alpha-numerics
                    if(! /^[A-Za-z0-9_]+$/.test(n)) {
                        console.log("Error: translation table file contains malformatted lines! System names should be alpha-numeric and non-empty.");
                        error();
                        return;
                    }

                    registerBaseSystemName(n);

                    // fourth field contains variants (boolean values: true/on/with/mit or false/off/without/ohne)
                    // i.e. "ohne Schwa-Tilgung,mit j-Tilgung,mit Diphthongzusammenfall vor r"
                    registerVariations(symbols[3]);
                }
            }

            // check result
            if (allLinesEmpty) {
                console.log("Error: translation table file has only empty lines!");
                error();
                return;
            }

            // check result
            if (baseSystemNames.length <= 0) {
                console.log("Error: no base system names found in translation table file!");
                error();
                return;
            }
            if (variationNames.length <= 0) {
                console.log("Warning: no variation names found in translation table file!");
            }

            for (x = 0; x < lines.length; x++) {
                if (lines[x].length > 0) {
                    // irgnore comment lines
                    if (/^#/.test(lines[x])) {
                        continue;
                    }

                    // splitting on commas, but not commas inside "" or ''
                    symbols = lines[x].split(/,(?![^"]*"(?:(?:[^"]*"){2})*[^"]*$)/);

                    // we want to
                    //   create a binary code from variation fieldx
                    //   that tells us, which variations are active for the current system
                    //   (i.e. 001 means "false,false,true" or "off,off,on" or "ohne,ohne,mit")

                    let variationCode = getVariationCodeFromString(symbols[3]);

                    let name = symbols[0] + symbols[1] + variationCode;

                    // register font name for current system
                    fontNames[name] = symbols[2];

                    const a = [];
                    for (y = 4; y < symbols.length; y++) {
                        a.push(symbols[y]);
                    }
                    tab[name] = a;
                    picker[name] = [];
                }
            }
            systemNames = Object.keys(tab);
            amountOfSystems = systemNames.length;
            if (amountOfSystems === 1) {
                console.log("Warning: Only one system found!");
            }
            registerVariationPossibilities();
            init_picker(func);
        } else {
            // file is empty
            console.log("Error: translation table file has no content!");
            error();
            return;
        }
    };
    xhr.send(null);
}

/**
 * insert base system name into array if it do not exist
 *
 * @param {String} systemName
 *
 */
function registerBaseSystemName(systemName) {

    if (debugMode) {
        console.log("registerBaseSystemNames(systemName) called. systemName=");
        console.log(systemName);
    }

    // check parameters
    if (systemName === null || typeof systemName !== "string") {
        if (debugMode) {
            console.log("Invalid parameters!");
        }
        return;
    }

    if (systemName !== "" && baseSystemNames.indexOf(systemName) === -1) {
        if (debugMode) {
            console.log("Register base system name '" + systemName + "'");
        }
        baseSystemNames.push(systemName);
    }
}

/**
 *
 * insert names of system variations into array if they do not exist
 * we expect a string like "variationSwitch[0] W,variationSwitch[1] X" and
 * want to register W and X in array
 *
 * @param {String} str
 */
function registerVariations(str) {

    if (debugMode) {
        console.log("registerVariations(str) called. str=");
        console.log(str);
    }

    // check parameters
    if (str === null || typeof str !== "string") {
        if (debugMode) {
            console.log("Invalid parameters!");
        }
        return;
    }

    let i;

    // get rid of all quotes and "variationSwitch[0] " and "variationSwitch[1] "
    str = str.replace(/["']/g, "");
    let regExp = new RegExp(variationSwitch[0] + " |" + variationSwitch[1] + " ", "g");
    str = str.replace(regExp, "");

    // comma is field seperator
    let variations = str.split(",");

    for (i = 0; i < variations.length; i++) {
        if (variations[i] !== "" && variationNames.indexOf(variations[i]) === -1) {
            if (debugMode) {
                console.log("Register variation name '" + variations[i] + "'");
            }
            variationNames.push(variations[i]);
        }
    }
}

/**
 * not all base systems have all possibilities
 * we want a structure that provides the possibility for fast lookups ...
 * we assume that all possible variants are collected in variationNames
 *
 */
function registerVariationPossibilities() {

    if (debugMode) {
        console.log("registerVariationPossibilities() called.");
    }

    let variationsAmount = variationNames.length;

    let basename;
    let variation;
    let variations;

    let i;

    let r = new RegExp("[012]{" + variationsAmount + "}$");
    let s = new RegExp("[012]", "g");

    /*
     * for each base system name we want an associative array
     * with keys that are variation names and values true or false
     * true in case that there exists a variation of the base system
     * false if that variation does not exist
     *
     */
    for (let systemName in tab) {

        basename = getBaseSystemNameBySystemName(systemName);

        // init variationPossibilities for basename with -2 for all variations

        if (basename !== null && !(basename in variationPossibilities)) {
            variationPossibilities[basename] = [];
            for (i = 0; i < variationNames.length; i++) {
                variationPossibilities[basename][variationNames[i]] = -2;
            }
        }

        /*
         * if we can find 0 and 1 for a variation for a base system
         * then for this base system the variation is possible and
         * we can register 'true' in the resulting array
         *
         * initially we have -2 in the resulting array
         *   if we find a 0, set resulting array field to -1
         *   if we find a 1, set resulting array field to  0
         * if we have a -1 in the resulting array field (we have found a 0 previously)
         *    and if we find a 1 then we can set the resulting array field to 'true'
         * if we have a 0 in the resulting array field (we have found a 1 previously)
         *    and if we find a 0 then we can set the resulting array field to 'true'
         *
         */

        variation = systemName.match(r);
        if (variation !== null) {
            variations = variation[0].match(s);
            if (basename !== null && variations !== null) {
                for (i = 0; i < variations.length; i++) {
                    switch (variationPossibilities[basename][variationNames[i]]) {
                        case -2:
                            if (variations[i] === "0") {
                                variationPossibilities[basename][variationNames[i]] = -1;
                            }
                            if (variations[i] === "1") {
                                variationPossibilities[basename][variationNames[i]] = 0;
                            }
                            if (variations[i] === "2") {
                                variationPossibilities[basename][variationNames[i]] = false;
                            }
                            break;
                        case -1:
                            if (variations[i] === "1") {
                                variationPossibilities[basename][variationNames[i]] = true;
                            }
                            break;
                        case 0:
                            if (variations[i] === "0") {
                                variationPossibilities[basename][variationNames[i]] = true;
                            }
                            break;
                        case true:
                            break;
                        default:
                            break;
                    }
                }
            }
        }
    }

    /*
     * set all invalid values in resulting array
     * (not 'true' or 'false') to 'false'
     */

    for (let systemName in variationPossibilities) {
        if (variationPossibilities.hasOwnProperty(systemName)) {
            for (let variationName in variationPossibilities[systemName]) {
                if (variationPossibilities[systemName].hasOwnProperty(variationName)) {
                    if (variationPossibilities[systemName][variationName] !== true && variationPossibilities[systemName][variationName] !== false) {
                        variationPossibilities[systemName][variationName] = false;
                    }
                }
            }
        }
    }
}

/**
 * fill picker tab with characters for each system from a file
 * (works pretty much like init_tab)
 *
 * @param {function} func - function that will be called after all picker layouts were loaded
 */
function init_picker(func) {

    let xhr = new XMLHttpRequest();
    xhr.overrideMimeType("text/plain");

    (function loop(i, length) {
        if (typeof length !== "number") {
            return;
        }

        if (i >= length) {

            // call "last" function after all pickers are filled
            func();

            return;
        }

        /*
         * at the moment there are only picker layout files for base systems
         * (not for complete systems = base system + variation)
         */

        let fileName = "https://udtale.de/wp-content/symbotrans-master/data/" + getBaseSystemNameBySystemName(systemNames[i]) + ".csv";

        xhr.open("GET", fileName);

        xhr.onload = function () {
            if (xhr.status !== 200 && xhr.status !== 0) {
                fillPickerWithTabSymbols();
                loop(i + 1, length);
                return;
            }
            let txt = xhr.response;
            if (txt != null && txt !== "") {

                // split input on line breaks
                let lines = txt.split(/\r?\n/);

                if (lines.length <= 0) {
                    // file contains to few lines
                    console.log("Warning: picker file " + fileName + " contains not enough lines!");
                    if (!debugMode) {
                        console.log("Filling picker with data from translation table.")
                    }
                    fillPickerWithTabSymbols();
                    loop(i + 1, length);
                    return;
                }


                let symbols;
                let x, y;

                let allLinesEmpty = true;

                picker[systemNames[i]].length = 0;

                /*
                 * picker for systemName can consist of multiple rows
                 * each row should be an array
                 * so picker for systemName can be an array of arrays
                 */

                for (x = 0; x < lines.length; x++) {
                    if (lines[x].length > 0) {

                        // irgnore comment lines
                        if (/^#/.test(lines[x])) {
                            continue;
                        }

                        allLinesEmpty = false;

                        // splitting on commas, but not commas inside "" or ''
                        symbols = lines[x].split(/,(?![^"]*"(?:(?:[^"]*"){2})*[^"]*$)/);

                        const a = [];
                        for (y = 0; y < symbols.length; y++) {
                            a.push(symbols[y]);
                        }
                        picker[systemNames[i]].push(a);
                    }
                }

                if (allLinesEmpty) {
                    // file contains only empty lines
                    console.log("Warning: picker file " + fileName + " only contains empty lines!");
                    if (!debugMode) {
                        console.log("Filling picker with data from translation table.")
                    }
                    fillPickerWithTabSymbols();
                    loop(i + 1, length);
                    return;
                }

            } else {
                // file is empty
                console.log("Warning: picker file " + fileName + " is empty!");
                if (!debugMode) {
                    console.log("Filling picker with data from translation table.")
                }
                fillPickerWithTabSymbols();
                loop(i + 1, length);
                return;
            }
            loop(i + 1, length);
        };

        function fillPickerWithTabSymbols() {
            if (debugMode) {
                console.log("Filling picker with data from translation table.")
            }

            // fill picker with data from translation table

            picker[systemNames[i]].length = 0;

            // remove duplicates
            let tmp_picker = tab[systemNames[i]].slice();
            let tmp_cmp = [];

            for (let j = 0; j < tmp_picker.length; j++) {
                if (!tmp_cmp[tmp_picker[j]]) {
                    picker[systemNames[i]].push(tmp_picker[j]);
                    tmp_cmp[tmp_picker[j]] = true;
                }
            }
        }

        xhr.onerror = function () {
            if (debugMode) {
                console.log("Error while accessing file " + fileName + " !");
                console.log("Cannot fill picker with individual data!");
            }
            fillPickerWithTabSymbols();
            loop(i + 1, length);
        };

        xhr.send(null);
    })(0, amountOfSystems);
}

/**
 * Takes a system object and an id and sets
 * all parameters of the system object accordingly to the id.
 *
 * @param {object} sys
 * @param {number} id
 */
function setSystemById(sys, id) {

    if (debugMode) {
        console.log("setSystemById(sys, id) called. sys=");
        console.log(sys);
        console.log("id=" + id);
    }

    // check parameters
    if (sys !== selectedDstSystem && sys !== selectedSrcSystem && typeof id !== "number") {
        if (debugMode) {
            console.log("Invalid parameters!");
        }
        return;
    }

    // check id range
    if (id < 0 || id >= amountOfSystems) {
        if (debugMode) {
            console.log("Given id '" + id + "' out of range! Using 0 ...");
        }
        id = 0;
    }

    let i;
    let r = new RegExp("[012]{" + variationNames.length + "}$");
    let s = new RegExp("[012]", "g");
    let x, y;

    // set system
    sys.id = id;
    sys.name = systemNames[id];
    sys.baseName = getBaseSystemNameBySystemName(sys.name);
    sys.variations = null;

    // check for variation code
    x = sys.name.match(r);
    if (x !== null) {
        sys.variations = [];

        // apply each digit
        y = x[0].match(s);
        for (i = 0; i < variationNames.length; i++) {
            sys.variations[variationNames[i]] = y[i];
        }
    }
}

/**
 * Takes a system object and a name,
 * searches for a corresponding name and id in the system tables
 * and sets the system accordingly to the found id.
 *
 * @param {object} sys
 * @param {String} name
 */
function setSystemByName(sys, name) {

    if (debugMode) {
        console.log("setSystemByName(sys, name) called. sys=");
        console.log(sys);
        console.log("name=" + name);
    }

    // check parameters
    if (sys !== selectedDstSystem && sys !== selectedSrcSystem && typeof name !== "string") {
        if (debugMode) {
            console.log("Invalid parameters!");
        }
        return;
    }

    let i, j;
    let id;
    let nameFound = false;
    let n = name;
    let o;

    // check if system name is in table
    // or if given name is a basic system name in table
    //
    // first with given name
    // then with given name without possible variation code

    for (j = 0; j < 2; j++) {
        if (n !== null && n !== "") {
            if (n in tab) {
                for (i = 0; i < amountOfSystems; i++) {
                    if (systemNames[i] === n) {
                        if (debugMode) {
                            console.log("Total given system name '" + systemNames[i] + "' found");
                        }
                        id = i;
                        nameFound = true;
                        break;
                    }
                }
            } else {
                for (i = 0; i < amountOfSystems; i++) {
                    o = getBaseSystemNameBySystemName(systemNames[i]);
                    if (o !== null && o !== "" && o === n) {
                        if (debugMode) {
                            console.log("Part of given system name '" + o + "' found");
                        }
                        id = i;
                        nameFound = true;
                        break;
                    }
                }
            }
        }
        if (nameFound) {
            break;
        }
        n = getBaseSystemNameBySystemName(name);
    }

    // if name was not found take the default systems
    if (!nameFound) {
        if (debugMode) {
            console.log("Given system name not found! Using defaults.");
        }
        id = 0;
        if (sys === selectedDstSystem) {
            id = defaultDstSystem;
        }
        if (sys === selectedSrcSystem) {
            id = defaultSrcSystem;
        }
    }

    setSystemById(sys, id);

}

/**
 * Takes a string that contains keywords that states if a variation is active or
 * not and returns a String of digits (0|1) with same information.
 *
 * For example: input: "variationSwicht[0], variationSwitch[1], variationSwitch[1]"
 *              output: "100"
 *
 * @param {String} str
 * @returns {String}
 */
function getVariationCodeFromString(str) {

    if (debugMode) {
        console.log("getVariationCodeFromString(str) called. str=" + str);
    }

    // check parameters
    if (str === null || typeof str !== "string") {
        if (debugMode) {
            console.log("Invalid parameters!");
        }
        return null;
    }

    let i;
    let result = "";
    str = str.replace(/["']/g, "");
    let variations = str.split(",");
    let v;
    let w;
    let variation = [];

    for (i = 0; i < variations.length; i++) {
        if (variations[i] !== "") {
            v = variations[i].substr(0, variations[i].indexOf(' '));
            w = variations[i].substr(variations[i].indexOf(' ') + 1);
            if (v === variationSwitch[0]) {
                variation[w] = 1;
            } else {
                // variationSwitch[1]
                variation[w] = 0;
            }
        }
    }

    for (i = 0; i < variationNames.length; i++) {
        if (variationNames[i] in variation) {
            result = result + variation[variationNames[i]];
        } else {
            result = result + "2";
        }
    }

    return result;
}

/**
 * Takes a full system name and returns the base system name.
 * For example:  input: "DaniaUnicode000"
 *              output: "DaniaUnicode"
 *
 * @param {String} name
 * @returns {String}
 */
function getBaseSystemNameBySystemName(name) {

    if (debugMode) {
        console.log("getBaseSystemNameBySystemName(name) called. name=" + name);
    }

    // check parameters
    if (name === null || typeof name !== "string") {
        if (debugMode) {
            console.log("Invalid parameters!");
        }
        return null;
    }

    let result = name.match("^[A-Za-z]+")[0];

    if (baseSystemNames.indexOf(result) !== -1) {
        return result;
    }

    return null;
}

/**
 * Takes a system object and transforms it into the next one.
 *
 * @param {object} sys
 */
function incrSystemId(sys) {
    if (debugMode) {
        console.log("incrSystemId(sys) called. sys=");
        console.log(sys);
    }

    // check parameters
    if (sys !== selectedDstSystem && sys !== selectedSrcSystem) {
        if (debugMode) {
            console.log("Invalid parameters!");
        }
        return;
    }

    let nextId = sys.id + 1;

    if (nextId < 0 || nextId >= amountOfSystems) {
        nextId = 0;
    }

    setSystemById(sys, nextId);
}

/**
 * get all possible parts of a string as array of arrays
 * modifies global variable collectedParts
 *
 * takes a result array and a string
 *
 * example:
 * getParts([], "abc")
 *
 * produces
 *
 * collectedParts=
 * [
 *  [ "a", "b", "c"],
 *  [ "a", "bc"],
 *  [ "ab", "c"],
 *  [ "abc"]
 * ]
 *
 * @param {Array} result
 * @param {String} str
 */
function getParts(result, str) {

    if (debugMode) {
        console.log("getParts(result, str) called. result=");
        console.log(result);
        console.log("str=");
        console.log(str);
    }

    let i;

    // empty global variable if result is empty
    if (result.length === 0) {
        collectedParts.length = 0;
    }

    // if str is empty then we got a complete result
    if (str.length === 0) {
        const p = result.slice();
        collectedParts.push(p);
    } else {
        // if str is not empty go on building complete result

        // if str contains "(...)" blocks
        // they need to be translated together
        // otherwise we deal with each character on its own

        // Note that in this case only "(...)" blocks will
        // be regarded!

        if (bracketPartDetection && str.indexOf('(') !== -1 && str.indexOf(')') !== -1) {
            let bracketParts = str.match(/\([^()]*\)/g);
            for (i = 1; i <= bracketParts.length; i++) {
                const r = result.slice();
                r.push(bracketParts.slice(0, i).join());
                getParts(r, bracketParts.slice(i).join());
            }
        } else {
            for (i = 1; i <= str.length; i++) {
                const r = result.slice();
                r.push(str.substr(0, i));
                getParts(r, str.substr(i));
            }
        }
    }
}

/**
 * takes all collected parts from global variable collectedParts
 *
 * modifies global variable translatedParts
 *
 * runs through translation table and translates whatever possible
 */
function translateParts() {

    if (debugMode) {
        console.log("translateParts() called.");
    }

    /**
     * we assume that collectedParts contains all
     * parts that should be translated
     *
     */

    /**
     * no translation needed if
     * source and target system are the same
     * but we want to sort out those collected parts
     * that are not part of translation table
     */

    let h, i, j, k;

    let found = 0;

    let x;
    let r = [];
    let u = [];

    translatedParts.length = 0;

    for (h = 0; h < collectedParts.length; h++) {
        for (i = 0; i < collectedParts[h].length; i++) {

            // no translation for current part found at this moment
            found = 0;

            for (j = 0; j < tab[selectedSrcSystem.name].length; j++) {
                x = 0;
                if (collectedParts[h][i] === tab[selectedSrcSystem.name][j]) {

                    /**
                     * it is possible that one part can be translated in multiple
                     * ways, so we need to check the whole table and cannot
                     * interrupt lookup process
                     */

                    // initially create an empty array
                    // so that we can append results to it
                    if (r.length === 0) {
                        r.push([]);
                        x = 0;
                    }

                    if (found === 1) {
                        x = r.length;
                        // we need to duplicate all result arrays
                        // if we translate into another system
                        if (selectedSrcSystem.id !== selectedDstSystem.id) {
                            /**
                             * the last entry in all result arrays
                             * was the last translation result of
                             * the part we are currently translating,
                             * so dismiss it
                             */
                            for (k = 0; k < x; k++) {
                                const nr = r[k].slice(0, -1);
                                r.push(nr);
                            }
                        }
                    }

                    // append new translation to all new result arrays
                    // (those who miss the last result)
                    for (k = x; k < r.length; k++) {
                        r[k].push(tab[selectedDstSystem.name][j]);
                    }
                    found = 1;
                }
            }

            if (found === 0) {
                // still no translation for current part found
                // so collected part is invalid and we can dismiss it
                r.length = 0;
                break;
            }
        }
        if (r.length > 0) {

            // there is at least one translation result

            for (k = 0; k < r.length; k++) {
                if (r[k].length > 0) {
                    const s = r[k].slice();
                    r[k].length = 0;

                    u.push([collectedParts[h], s]);
                }
            }
            r.length = 0;
        }
    }

    if (debugMode) {
        console.log("Result before filtering:");
        console.log(u);
    }

    // now run through several filters to refine result
    // if filters are currently active

    let tmp_u = [];

    // remove all results that can be created from more parts
    // we want to take the more specific input that is an input
    // consisting of less parts (when total length is the same)

    if (removeLongSrcParts) {
        let smallestPartAmount = -1;

        for (i = 0; i < u.length; i++) {
            if (smallestPartAmount === -1 || smallestPartAmount > u[i][0].length) {
                smallestPartAmount = u[i][0].length;
            }
        }

        for (i = 0; i < u.length; i++) {
            if (u[i][0].length === smallestPartAmount) {
                tmp_u.push(u[i]);
            }
        }

        u = tmp_u;
        tmp_u = [];
    }

    // remove duplicates by
    // building strings from collected arrays delimitted with ,
    // and comparing them
    if (removeDuplicateDstParts) {
        r.length = 0;
        for (i = 0; i < u.length; i++) {
            if (!r[u[i][1].join(',')]) {
                tmp_u.push(u[i]);
                r[u[i][1].join(',')] = true;
            }
        }
        u = tmp_u;
        tmp_u = [];
    }

    // remove smaller results
    if (removeSmallerDstParts) {

        r.length = 0;
        r = [];

        // collect all "same" results
        for (i = 0; i < u.length; i++) {
            let key = u[i][1].join('');
            if (typeof r[key] === 'undefined') {
                r[key] = [];
            }
            r[key].push(u[i]);
        }

        // take that result of "same" results that
        // has less parts
        for (i = 0; i < Object.keys(r).length; i++) {
            let lastLength = -1;
            let smallestElement = null;
            for (k = 0; k < r[Object.keys(r)[i]].length; k++) {
                let l = r[Object.keys(r)[i]][k][1].length;
                if (l < lastLength || lastLength === -1) {
                    smallestElement = r[Object.keys(r)[i]][k];
                }
            }
            tmp_u.push(smallestElement);
        }

        u = tmp_u;
        tmp_u = [];
    }

    if (debugMode) {
        console.log("Result after filtering:");
        console.log(u);
    }

    // we don't need src information anymore
    // for translation result
    for (i = 0; i < u.length; i++) {
        translatedParts.push(u[i][1]);
    }

}

/**
 * Takes an input and calls all approbriate functions
 * to process it and to generate a result.
 *
 * @param {String} input
 */
function parseInput(input) {
    if (debugMode) {
        console.log("parseInput(input) called. input=");
        console.log(input);
    }
    getParts([], input);

    if (debugMode) {
        console.log("Got parts. collectedParts=");
        console.log(collectedParts);
    }

    translateParts();

    if (debugMode) {
        console.log("Parts translated. translatedParts=");
        console.log(translatedParts);
    }
}
