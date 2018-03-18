var pendingCredentials = []; //List for pending in memory credentials (registrations, new unknown logins)
var debug = true; //Defines if writeLine outputs messages
var pushPasswordQueue; //Password store queue
var getPasswordQueue; //Password get queue
var lh; //Support multiple languages

//Write debug messages to the console
function writeLine(message){
	if (debug) console.log(message);
}

//Set the Icon of the popup panel
function setUIIcon() {
	var icon = "";
	var numberOfPending = pendingCredentials.length;
	if (numberOfPending > 0) icon = "icon2.png";
	else icon = "icon1.png";

	chrome.browserAction.setIcon({path: icon}); //Set the icon
	chrome.browserAction.setBadgeText({text: numberOfPending.toString()}); //Set the number of pending credentials
}

//Class for netwroking with the native application
class NetworkHandler {

	//Build a new HTTP Request
	buildRequest(resource, successFunc, failFunc, extraHeaders, method, postData) {
		$.ajax({
			type: method, //GET or POST
			dataType: "text",
			data: postData, //Set the reuqest body
			url: "http://127.0.0.1/" + resource, //Set the requested function
			success: successFunc, //Success callback
			error: failFunc, //Error callback
			headers: extraHeaders, //Extra headers
			timeout: 3000 //Default 3 second connection timeout (should be ok for localhost)
		});
	}

	//Get secure random string data from the server
	getRandomPassword() {
		var inst = this;
		var promise = new Promise(function (resolve, reject) {
			inst.buildRequest("get-random", function (response) {
				resolve(response.substring(10));
			}, function (xhr, opt, twerror) {
				reject(twerror);
			}, {}, "GET", "");
		});

		return promise;
	}

	//Get tracker ID from the server
	getRequestToken() {
		var inst = this;
		var promise = new Promise(function (resolve, reject) {
			inst.buildRequest("tracker", function(response) {
				inst.clientTracker = response;
				inst.trackerSet = true;
				resolve();
			}, function (xhr, opt, twerror) {
				reject(twerror);
			}, {}, "GET", "");
		});
		
		return promise;
	}

	//Pad string with 0s to achive request body encoding
	padStringLength(inputString) {
		var inputstringLength = inputString.length;
		var strInputstringLength = inputstringLength.toString();
		for (var i = 10 - strInputstringLength.length; i > 0; i--) {
			strInputstringLength = "0" + strInputstringLength;
		}

		return strInputstringLength + inputString;
	}

	//Store credentials on the phone
	pushCredentials(credentialObject) {
		var inst = this;
		var userNamePart = inst.padStringLength(credentialObject.user);
		var passwordPart = inst.padStringLength(credentialObject.pass);
		var fullRequestString = userNamePart + passwordPart + credentialObject.url;
		writeLine("Requesting: " + fullRequestString);

		var promise = new Promise(function(resolve, reject) {
			inst.buildRequest("stor-pw", function(response) {
				writeLine("Password Push result: " + response);
				resolve();
			}, function (xhr, opt, twerror) {
				reject(twerror);
			}, {
				"Client-Tracker": inst.clientTracker
			}, "POST", fullRequestString);
		});
		
		return promise;
	}

	//Get credentials from the phone
	pushGetRequest(url) {
		var inst = this;
		var promise = new Promise(function(resolve, reject) {
			inst.buildRequest("getpw", function (response) {
				writeLine("URL Push result: " + response);
				resolve();
			}, function (xhr, opt, twerror) {
				reject(twerror);
			}, {
				"Client-Tracker": inst.clientTracker
			}, "POST", url);
		});

		return promise;
	}

	//Check the server for password store results
	checkServer(intervalToken, resolve, reject, inst) {
		inst.buildRequest("stor-state", function(response) {
			if (response === "stor-completed") {
				clearInterval(intervalToken);
				writeLine("Interval Clear");
				resolve();
			}
			else if (response === "stor-fail") {
				clearInterval(intervalToken);
				writeLine("Interval Clear");
				reject(Error("Failed to push the credentials to the phone"));
			}
			
		}, function (xhr, opt, twerror) {
			reject(twerror);
		}, {
			"Client-Tracker": inst.clientTracker
		}, "GET", "");
	}

	//Request body decode the data
	getCredentialObject(inputString) {
		var userLength = inputString.substring(0, 10);
		var intUserLength = parseInt(userLength);
		var userName = inputString.substring(10, 10 + intUserLength);
		var passwordLength = inputString.substring(10 + intUserLength, 20 + intUserLength);
		var intPasswordLength = parseInt(passwordLength);
		var password = inputString.substring(20 + intUserLength, 20 + intUserLength + passwordLength)
		return {
			"user": userName,
			"pass": password
		};
	}

	//Check the server for getting credentials
	checkServerGet(intervalToken, resolve, reject, inst) {
		inst.buildRequest("get-state", function (response) {
			if (response.startsWith("get-ok")) {
				clearInterval(intervalToken);
				writeLine("get credentials request succeeded");
				resolve(inst.getCredentialObject(response.substring(6)));
			}
			else if (response === "get-fail") {
				clearInterval(intervalToken);
				writeLine("get credentials request failed");
				reject();
			}
		}, function (xhr, opt, twerror) {
			writeLine("Failed to check get request: " + twerror);
			reject();
		}, {
			"Client-Tracker": inst.clientTracker
		}, "GET", "");
	}

	//Begin checking the server for store results
	//Return promise
	beginPushResultChecking() {
		var inst = this;
		var promise = new Promise(function (resolve, reject) {
			var checkingLoop = setInterval(function () {

				inst.checkServer(checkingLoop, resolve, reject, inst);

			}, 5000);
		});

		return promise;
	}

	//Begin checking the server for get results
	//Returns promise
	beginGetResultChecking() {
		var inst = this;
		var promise = new Promise(function (resolve, reject) {
			var checkingLoop = setInterval(function () {
				inst.checkServerGet(checkingLoop, resolve, reject, inst);
			}, 5000);
		});

		return promise;
	}
}

//Queue for get/store requests
class QueueManager {

	//Init the Queue
	constructor() {
		this.queue = [];
	}

	//Add URL To the queue
	add(url, state, extraData) {
		if (extraData !== undefined) { //Extra data parameter defined
			this.queue.push({
				"url": url,
				"state": state,
				"extra": extraData
			});
		}
		else { //No extra data parameter
			this.queue.push({
				"url": url,
				"state": state
			});
		}
	}

	//Update queue entry
	update(url, state, extraData) {
		for (var i = 0; i < this.queue.length; i++) {
			var currentItem = this.queue[i];
			if (currentItem.url === url) {
				if (extraData !== undefined) { //Upadte extra data
					currentItem.extraData = extraData;
				}

				if (state !== undefined) { //Update entry state
					currentItem.state = state;
				}

				break;
			}
		}
	}

	//Remove an entry from the queue
	remove(url) {
		for (var i = 0; i < this.queue.length; i++) {
			var currentItem = this.queue[i];
			if (currentItem.url == url) {
				this.queue.splice(i, 1);
				break;
			}
		}
	}

	//Get the state of an entry
	getState(url) {
		for (var i = 0; i < this.queue.length; i++) {
			var currentItem = this.queue[i];
			if (currentItem.url == url) {
				return currentItem.state;
			}
		}
	}

	//Get the extra data on an entry
	getExtra(url) {
		for (var i = 0; i < this.queue.length; i++) {
			var currentItem = this.queue[i];
			if (currentItem.url == url) {
				return currentItem.extraData;
			}
		}
	}
}

//Class for supporting multiple languages
class LanguageHandler {

	constructor () { //Init the language handler
		this.defaultLanguage = "en"; //Set the default language to english
		var languageSettings = localStorage.getItem("language"); //Get the language settings stored in localStorage
		this.language = (languageSettings !== null) ? languageSettings : this.defaultLanguage; //Set the language to default or the selected
		this.loadContent = function () { //Define language loading function
			var inst = this; //Save instance
			var promise = new Promise(function (resolve, reject) {
				$.getJSON(`lang/${inst.language}.json`, function (result) { //Get the current language's file
					inst.content = result; //Store the file's contents in memory
					resolve();
				});
			});

			return promise;
		};
	}

	//Load the language initially
	init() {
		return this.loadContent();
	}

	//Change the current language
	setLanguage(language) {
		localStorage.setItem("language", language); //Write changes to localStorage
		this.language = language; //Set the current language in memory
		return this.loadContent(); //Reload the language list
	}

	//Get the current language
	getLanguage() {
		return this.language;
	}

	//Get the messages of a specific context from the current language
	getContent(context) {
		return this.content[context]; //Return the specified context's messages
	}
}

//Remove a credential from the pending list
function removeCredentials(url) {
	for (var i=0; i < pendingCredentials.length; i++) {
		var currentItem = pendingCredentials[i];
		if (currentItem.url.href === url.href) {
			pendingCredentials.splice(i, 1);
			setUIIcon();
			break;
		}
	}
}

//Add url to the local storage (url has stored password)
function rememberLogin(url) {
	var stringUrlList = localStorage.getItem("has_creds");
	if (stringUrlList === null) //Current list empty
	{
		localStorage.setItem("has_creds", JSON.stringify([url]));
	}
	else //Current list has items
	{
		var urlArray = JSON.parse(stringUrlList);
		urlArray.push(url);
		localStorage.setItem("has_creds", JSON.stringify(urlArray));
	}
}

//Setup generate password context menu
function setupContextMenu() {
	//Add the context menu to chrome
	var content = lh.getContent("background_script");
	var contextMenuTitle = lh.getContent("background_script").context_menu_generate_random_password;
	chrome.contextMenus.create({
		title: contextMenuTitle,
		type: "normal",
		id: "fpa_generate_random_password",
		contexts: ["editable"]
	});

	//Listen for context menu clicks
	chrome.contextMenus.onClicked.addListener(function (info, tab) {
		writeLine("Context menu clicked");
		writeLine(info);
		if (info.menuItemId !== "fpa_generate_random_password") return; //Check if our context menu is clicked
		var nh = new NetworkHandler();
		nh.getRandomPassword().then(function (pass) { //Get random password
			chrome.tabs.sendMessage(tab.id, {"cmd": "fpa_set_randomPassword", "success": true, "value": pass}); //Send random password to content script
		}, function (errorMessage) { //Server offline
			writeLine("Error occurred: " + errorMessage);
			chrome.tabs.sendMessage(tab.id, {"cmd": "fpa_set_randomPassword", "success": false}) //Send error to content script
		});
		
	});
}

//Entry point
writeLine("Background Script Running");
var init = function () {
	pushPasswordQueue = new QueueManager();
	getPasswordQueue = new QueueManager();
	setupContextMenu();

	//Message from exensions
	chrome.runtime.onMessage.addListener(function (input, sender, sendResponse) {

		writeLine("Got request");
		writeLine(input);

		if (input.req === "stor") { //Add credentials to the pedning list
			var credentials = {
				"user": input.user,
				"pass": input.pass,
				"url": input.url
			};

			pendingCredentials.push(credentials);
			setUIIcon();
		}
		else if (input.req === "get_all") { //Get pending credentials
			sendResponse(pendingCredentials);
		}
		else if (input.req === "remove") { //Remove pedning credential from pending list
			removeCredenitals(input.url);
		}
		else if (input.req === "push") { //Add credential to the phone's DB
			var nh = new NetworkHandler();
			pushPasswordQueue.add(input.url, "pending");
			nh.getRequestToken().then(function () {
				writeLine("Got requets token");
				nh.pushCredentials(input).then(function () {
					writeLine("Push completed");
					nh.beginPushResultChecking().then(function () {
						writeLine("Credentials Stored");
						removeCredentials(input.url);
						pushPasswordQueue.update(input.url, "done");
						rememberLogin(input.url);
					}, function(reason3) {
						writeLine("Credential Store failed on server remotely promise:");
						writeLine(reason3);
						pushPasswordQueue.update(input.url, "fail");
					});
				}, function(reason2) {
					writeLine("Credential push failed promise:");
					writeLine(reason2);
					pushPasswordQueue.update(input.url, "fail");
				});
			}, function (reason1) {
				writeLine("Token request failed promise:");
				writeLine(reason1);
				pushPasswordQueue.update(input.url, "fail");
			});
		}
		else if (input.req === "push-result") { //Get the state of the password store
			var state = pushPasswordQueue.getState(input.url);
			writeLine("Queue State: ");
			writeLine(state);
			if (state === "done" || state === "fail") //If done or failed
			{
				pushPasswordQueue.remove(input.url); //Remove password from the queue
			}
			sendResponse(state);
		}
		else if (input.req === "has-credential") { //Check if an url has stored credentials
			var stringUrlArray = localStorage.getItem("has_creds");
			if (stringUrlArray === null) {
				sendResponse({"result": false}); //No entry in the local store -> return false
			}
			else {
				var urlArray = JSON.parse(stringUrlArray); //Parse the array from the local storage
				if (urlArray.includes(input.url)) sendResponse({"result": true}); //Array has the URL -> return true
				else sendResponse({"result": false}); //Array doesn't have the URL -> return false
			}
		}
		else if (input.req === "get-credentials") { //Get credentials for an URL
			getPasswordQueue.add(input.url, "pending");
			var nh = new NetworkHandler(80);
			nh.getRequestToken().then(function () {
				nh.pushGetRequest(input.url).then(function () {
					nh.beginGetResultChecking().then(function (credentials) {
						writeLine("Got credentials");
						writeLine(credentials);
						getPasswordQueue.update(input.url, "done", credentials);
					}, function () {
						writeLine("Failed while get state phase");
						getPasswordQueue.update(input.url, "fail");
					});
				}, function () {
					writeLine("Failed to send get request");
					getPasswordQueue.update(input.url, "fail");
				});
			}, function () {
				writeLine("Failed to get token");
				getPasswordQueue.update(input.url, "fail");
			});
		}
		else if (input.req === "get-state") { //Check the state of getting the crendetials
			var state = getPasswordQueue.getState(input.url);
			var extra = getPasswordQueue.getExtra(input.url);
			if (state === "done" || state === "fail") {
				getPasswordQueue.remove(input.url);
			}

			var response;
			if (extra !== undefined) {
				response = {
					"status": state,
					"user": extra.user,
					"pass": extra.pass
				};
			}
			else {
				response = {
					"status": state
				};
			}
			sendResponse(response);
		}
		else if (input.req === "get-language-pack") { //Get language specific messages
			if (input.context.includes(";")) { //Check if the request has multiple contexts
				var contextLoadList = input.context.split(";");
				var contextList = [];
				for (var context in contextLoadList) {
					contextList.push(lh.getContent(context));
				}
				sendResponse({"lang_pack": contextList}); //Retrun multiple contexts
			}
			else sendResponse({"lang_pack": lh.getContent(input.context)}); //Return the requested context
		}
		else if (input.req === "get-current-language") { //Get the current language selected by the user
			sendResponse({"current_language": lh.getLanguage()})
		}
		else if (input.req === "set-current-language") { //Set the language of the extension
			if (typeof(input.language !== "undefined")) { //Check if the language is set in the request
				lh.setLanguage(input.language).then(function () {
					chrome.contextMenus.update("fpa_generate_random_password", {
						title: lh.getContent("background_script").context_menu_generate_random_password
					});

					chrome.runtime.sendMessage({"cmd": "fpa_set_languagePack", "lang_pack": lh.getContent("content_script")});
				});
			}
		}
		
	});
};
lh = new LanguageHandler(); //Create the language handler
lh.init().then(function () { //Init the language handler
	writeLine("Language Loaded");
	init(); //Start the background application
});