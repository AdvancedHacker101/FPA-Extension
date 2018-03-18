var languagePack; //The language specifc messages
var languageMap; //Map of language codes and long language names

//Load language specific messages
//Returns promise
function loadLanguagePack() {
	var promise = new Promise(function (resolve, reject) {
		chrome.runtime.sendMessage({"req": "get-language-pack", "context": "settings"}, function (langPack) { //Request data from background app
			languagePack = langPack.lang_pack; //Store the language pack globally
			resolve();
		});
	});

	return promise;
}

//Get the current language of the extension
//Returns promise
function getCurrentLanguage() {
	var promise = new Promise(function (resolve, reject) {
		chrome.runtime.sendMessage({"req": "get-current-language"}, function (curLang) { //Request data from background app
			resolve(curLang.current_language); //Resolve promise with the current language
		});
	});

	return promise;
}

//Load the language map file
//Return promise
function loadLangMap() {
	var promise = new Promise(function (resolve, reject) {
		$.getJSON("lang/langMap.json", function (result) { //Fetch the map json file
			languageMap = result; //Store the map globally
			resolve();
		});
	});

	return promise;
}

//Get a listItem for languages
//language: the long name of the language to display
//selectorTextNode: the textNode (the current language) assigned to the dropdown
//languageShortName: the short (code) name of the language
//caret: the textNode assigned to the dropdown
function getListItem(language, selectorTextNode, languageShortName, caret) {
	var listItem = document.createElement("li"); //Create the list item
	var hyperlink = document.createElement("a"); //Create the language displaying "a" tag
	hyperlink.href = "#"; //Point the "a" tag to void
	hyperlink.onclick = function () { //Set the onclick function TODO: test if language updates work at all!
		//Update dropdown
		var langSelector = document.getElementById("select_language"); //Get the dropdown
		langSelector.removeChild(selectorTextNode); //Remove the currentLanguage
		langSelector.removeChild(caret); //Remove the caret
		langSelector.appendChild(document.createTextNode(language)); //Assign the new language
		var caret = document.createElement("span"); //Create a span element (for the caret)
		caret.classList.add("caret"); //Apply the caret class to the span
		langSelector.appendChild(caret); //Append caret after changing current language
		//Update current language cache
		langCache = languageShortName;
		//Reload page content with new language, without reloading the language list
		formatPage(true);
		//Change background language settings
		chrome.runtime.sendMessage({"req": "set-current-language", "language": languageShortName});
	};
	hyperlink.appendChild(document.createTextNode(language)); //Display the language's name on the "a" tag
	listItem.appendChild(hyperlink); //Add the "a" tag to the listItem
	return listItem; //Return the listItem
}

//Load static/dynamic language specific/not specific data on this page
//skipList: true to skip loading of the language list (not language specific)
function formatPage(skipList) {
	//Set skipList, when value not given to false
	if (typeof(skipList) === "undefined") {
		skipList = false;
	}

	//Load static language based items
	for (var property in languagePack) {
		if (languagePack.hasOwnProperty(property)) {
			var element = document.getElementById(property); //Load the element, the message belongs to
			element.appendChild(document.createTextNode(languagePack[property])); //Display the message on the element
		}
	}

	//Load dynamic content
	var langSelector = document.getElementById("select_language"); //Get the dropdown
	var caret = document.createElement("span"); //Create the span (for the caret)
	caret.classList.add("caret"); //Apply the caret class to the span
	getCurrentLanguage().then(function (currentLanguage) { //Retrieve the current language
		var selectorTextNode = document.createTextNode(languageMap[currentLanguage]); //Create a textNode for the current language
		langSelector.appendChild(selectorTextNode); //Load current language name to dropdown
		langSelector.appendChild(caret); //Load the caret character after the current language

		if (!skipList) { //If listLoading not skipped
			var parentList = document.getElementById("languageList"); //Get the listElement
			for (var property in languageMap) {
				if (languageMap.hasOwnProperty(property)) {
					parentList.appendChild(getListItem(languageMap[property], selectorTextNode, property, caret)); //Load supported languages list
				}
			}
		}
	});
}

//Handle the back button's click event
function handleClick () {
	document.getElementById("back_button").addEventListener("click", function () { //Assign the event
		window.location.href = "ui.html"; //Redirect to the main page
	});
}

//Start the application
var init = function () {
	handleClick(); //Setup click handler
	formatPage(); //Initially format the page
};

//Entry point
loadLanguagePack().then(function () { //Load language data for the page
	loadLangMap().then(function () { //Load language map
		init(); //Load data into page
	});
});