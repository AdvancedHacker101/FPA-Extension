var debug = false; //True if debug version (for UI testing)
var languagePack; //The the language specific messages

//Create a listItem from credentials
//host: the host the credentials were captured on
//username: the submitted username
//password: the submitted password
//onadd: the onclick function for the add button
//onremove: the onlick function for the remove button
function getItem(host, username, password, onadd, onremove) {
	var getInner = function (text) {
		return document.createTextNode(text);
	};
	var maskPassword = function (pass) {
		var length = pass.length;
		var result = "";
		for (var i = 0; i < length; i++) {
			result += "*";
		}

		return result;
	};
	var listItem = document.createElement("span");
	listItem.classList.add("list-group-item");
	var hostHeading = document.createElement("h6");
	hostHeading.classList.add("list-item-heading");
	hostHeading.classList.add("listHeading");
	if (host.length > 17) { //Check if the host string is longer than the page can display
		hostHeading.title = host; //Set the full host as title
		//Get the first 17 characters of the host and append 3 dots to it
		host = host.substring(0, 17);
		host += "...";
	}
	hostHeading.appendChild(getInner(host));
	var userSmall = document.createElement("small");
	userSmall.classList.add("list-item-text");
	userSmall.appendChild(getInner(username));
	var passSmall = document.createElement("small");
	passSmall.appendChild(getInner(maskPassword(password)));
	var lineBreak = document.createElement("br");
	var addButton = document.createElement("span");
	addButton.classList.add("fui-plus-circle");
	addButton.classList.add("addButton");
	addButton.onclick = onadd;
	addButton.title = languagePack.add_button_title;
	var removeButton = document.createElement("span");
	removeButton.classList.add("fui-cross-circle");
	removeButton.classList.add("removeButton");
	removeButton.title = languagePack.remove_button_title;
	removeButton.onclick = onremove;
	listItem.appendChild(hostHeading);
	listItem.appendChild(userSmall);
	listItem.appendChild(removeButton);
	listItem.appendChild(addButton);
	listItem.appendChild(lineBreak);
	listItem.appendChild(passSmall);

	return listItem;
}

//Add no pending data heading
//parentElement: the parent element to append the heading to
function addNoElements (parentElement) {
	var heading = document.createElement("h6");
	heading.classList.add("noItems");
	heading.appendChild(document.createTextNode(languagePack.pending_list_empty));
	parentElement.appendChild(heading);
}

//Clear the list container element's children
function clearList() {
	var listContainer = document.getElementById("credential_list");
	while (listContainer.firstChild) {
		listContainer.removeChild(listContainer.firstChild);
	}
}

//Build the pending list from an array of credentials
function buildList(iterate) {
	//The parentElement containing the listItems
	var parent = document.getElementById("credential_list");

	//Clear the existing content
	clearList();

	if (iterate.length === 0) { //Handle empty arrays
		addNoElements(parent);
		return;
	}

	iterate.map(function (value, index){ //Loop through the credentials

		var currentItem; //The current listItem to be added

		var addCredentials = function () { //Add the adding function to the add button
			var bdMessage = {
				"user": value.user,
				"pass": value.pass,
				"req": "push",
				"url": value.url.href,
			};
			chrome.runtime.sendMessage(bdMessage);
			var promise = new Promise(function (resolve, reject) {
				var checkingLoop = setInterval(function () {
					var checkResult = {
						"req": "push-result",
						"url": value.url.href
					};
					//Check for the result of the add
					chrome.runtime.sendMessage(checkResult, function (result) {
						console.log("Got push result: " + result);
						if (result === "done") {
							clearInterval(checkingLoop);
							resolve();
						}
						else if (result === "fail") {
							clearInterval(checkingLoop);
							reject();
						}	
					});
				}, 5000);
			});

			promise.then(function () { //Credentials added
				parent.removeChild(currentItem); //Remove from the pending UI list
				console.log("Credentials stored");
			}, function () {
				console.log("Failed to store credentials");
				//TODO: display alert to the user
			});

		};

		

		var removeCredentials = function () { //Remove credential from the UI list
			parent.removeChild(currentItem); //Remove the item from the UI list
			var removeMessage = {
				"url": value.url,
				"req": "remove"
			};
			chrome.runtime.sendMessage(removeMessage); //Remove credential from the backend list
		};

		//Construct listItem from data
		currentItem = getItem(value.url.host, value.user, value.pass, addCredentials, removeCredentials);

		parent.appendChild(currentItem); //Add item to the list
	});
}

//Load the language specific messages, used by this page
//Returns promise
function loadLanguagePack() {
	var promise = new Promise(function (resolve, reject) {
		chrome.runtime.sendMessage({"req": "get-language-pack", "context": "UI"}, function (langPack) { //Fetch pack from server
			languagePack = langPack.lang_pack; //Set the global language container
			resolve();
		});
	});

	return promise;
}

//Assign click handler to the settings button
function handleClick() {
	document.getElementById("settings_button").addEventListener("click", function () {
		window.location.href = "settings.html"; //Redirect to settings page
	});
}

if (!debug) { //Not the debug version
	loadLanguagePack().then(function () {
		document.getElementById("settings_button").title = languagePack.open_settings_button_title; //Set the settings button's title
		handleClick(); //Setup the click handler
		chrome.runtime.sendMessage({req: "get_all"}, function (response){ //Get all pending credentials
			buildList(response); //Generate the UI list
		});
	}); //Load the language pack
}
else //Debugging (for UI testing)
{
	$(document).ready(function() {
		//Create fake data
		var x = [{
			"user": "user",
			"pass": "pass",
			"url": {
				"host": "192.168.10.62"
			}
		}];

		languagePack = {
			"add_button_title": "Store creds on phone",
			"remove_button_title": "Remove creds from list",
			"pending_list_empty": "No pending credentials"
		};

		x.push(x[0]);
		x.push(x[0]);
		x.push(x[0]);

		handleClick();
		buildList(x); //Build the UI from the fake data
	});
}