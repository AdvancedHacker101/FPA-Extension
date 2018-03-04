var debug = false; //True if debug version (for UI testing)

//UI Manager (back-end data -> UI)
class uiManager {

	//Get the main ul element
	constructor() {
		this.listElement = document.getElementById("cred_list");
	}

	//Get a listItem
	getListItem() {
		var listItem = document.createElement("li");
		return listItem;
	}

	//get the add button
	getAddButton() {
		var button = document.createElement("button");
		button.classList.add("add");
		button.title = "Add to password manager";
		return button;
	}

	//Get the remove button
	getRemoveButton() {
		var button = document.createElement("button");
		button.classList.add("remove");
		button.title = "Remove From Pending";
		return button;
	}

	//Get the website label
	getHostNameLabel() {
		var p = document.createElement("p");
		p.classList.add("userdata");
		p.classList.add("hostname");
		return p;
	}

	//Get the credential label
	getCredentialLabel() {
		var p = document.createElement("p");
		p.classList.add("userdata");
		p.classList.add("credential");
		return p;
	}

	//Get the div for the hostname and credentials
	getTextContainer() {
		var div = document.createElement("div");
		div.classList.add("credentials");
		return div;
	}

	//Get the div for the add and remove button
	getButtonContainer() {
		var div = document.createElement("div");
		div.classList.add("actionButtons");
		return div;
	}

	//Set the innerHTML of an element
	//element: the element to set the innerHTML of
	//text: the text to set the innerHTML to
	setInnerText(element, text) {
		element.appendChild(document.createTextNode(text));
	}

	//Set the onclick of a button
	//element: the button to set the onclick of
	//func: the onclick function
	setOnClick(element, func) {
		element.onclick = func;
	}

	//Add a list item to the list
	//listItem: the item to add to the list
	pushItem(listItem)
	{
		this.listElement.appendChild(listItem);
	}

	//Remove a listItem from the list
	//listItem: the item to remove from the list
	removeItem(listItem)
	{
		this.listElement.removeChild(listItem);
	}

	//Append an element to another
	//element: the element to append
	//parent: the element to append to
	addElement(element, parent)
	{
		parent.appendChild(element);
	}

	//Clear the ul list
	clearList() {
		$(this.listElement).empty();
	}
}

//Build the pending list from an array of credentials
function buildList(iterate) {
	var manager = new uiManager(); //Get a new UI manager
	manager.clearList(); //Cleare the previous list

	if (iterate.length === 0) { //Handle empty arrays
		var li = manager.getListItem();
		manager.setInnerText(li, "No Pending Credentials");
		manager.pushItem(li);
		return;
	}

	iterate.map(function (value){ //Loop through the credentials
		var li = manager.getListItem();
		var buttonContainer = manager.getButtonContainer();
		var addBtn = manager.getAddButton();

		var removeBtn = manager.getRemoveButton();

		manager.addElement(addBtn, buttonContainer);
		manager.addElement(removeBtn, buttonContainer);

		var textContainer = manager.getTextContainer();
		var hostField = manager.getHostNameLabel();
		var userNameField = manager.getCredentialLabel();
		var passwordField = manager.getCredentialLabel();

		manager.setInnerText(userNameField, value.user);
		//Replace password with (*) characters
		var displayPassword = "";
		for (var i=0; i < value.pass.length; i++) {
			displayPassword += "*";
		}
		manager.setInnerText(passwordField, displayPassword);
		manager.setInnerText(hostField, value.url.host);

		manager.addElement(hostField, textContainer);
		manager.addElement(userNameField, textContainer);
		manager.addElement(passwordField, textContainer);

		manager.addElement(textContainer, li);
		manager.addElement(buttonContainer, li);

		manager.pushItem(li);

		manager.setOnClick(addBtn, function () { //Add the adding function to the add button
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
						if (result === "done")
						{
							clearInterval(checkingLoop);
							resolve();
						}
						else if (result === "fail")
						{
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

		});

		manager.setOnClick(removeBtn, function () { //Remove credential from the UI list
			manager.removeItem(li); //Remove the item from the UI list
			var removeMessage = {
				"url": value.url,
				"req": "remove"
			};
			chrome.runtime.sendMessage(removeMessage); //Remove credential from the backend list
		});
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

		buildList(x); //Build the UI from the fake data
	});
}