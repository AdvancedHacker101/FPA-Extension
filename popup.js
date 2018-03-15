var debug = false; //True if debug version (for UI testing)

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
	addButton.title = "Save credentials on phone";
	var removeButton = document.createElement("span");
	removeButton.classList.add("fui-cross-circle");
	removeButton.classList.add("removeButton");
	removeButton.title = "Remove Credentials From list";
	removeButton.onclick = onremove;
	listItem.appendChild(hostHeading);
	listItem.appendChild(userSmall);
	listItem.appendChild(removeButton);
	listItem.appendChild(addButton);
	listItem.appendChild(lineBreak);
	listItem.appendChild(passSmall);

	return listItem;
}

//Draw a horizontal line
//parentElement: the element to draw the line on
function drawHorizontalLine (parentElement) {
	var hr = document.createElement("hr");
	parentElement.appendChild(hr);
}

//Add no pending data heading
//parentElement: the parent element to append the heading to
function addNoElements (parentElement) {
	var heading = document.createElement("h6");
	heading.classList.add("noItems");
	heading.appendChild(document.createTextNode("No Pending Credentials"));
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
				manager.removeItem(li); //Remove from the pending UI list
				console.log("Credentials stored");
			}, function () {
				console.log("Failed to store credentials");
				//TODO: display alert to the user
			});

		};

		var currentItem; //The current listItem to be added

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

		if (index + 1 != iterate.length) { //Not last iteration
			drawHorizontalLine(parent);
		}
	});
}

if (!debug) { //Not the debug version
	chrome.runtime.sendMessage({req: "get_all"}, function (response){ //Get all pending credentials
		buildList(response); //Generate the UI list
	});
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

		x.push(x[0]);
		x.push(x[0]);
		x.push(x[0]);

		buildList([]); //Build the UI from the fake data
	});
}