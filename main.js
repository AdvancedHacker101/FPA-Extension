var debug = true; //True to show debugging output

//Alert Window in the top right corner
class AlertWindow {

	//Dismiss alert window automatically after 10 seconds of opening it
	startAutoDismiss(container) {
		var inst = this;
		setTimeout(function () {
			if (container.getAttribute("data-dialog-closing") === "true") return;
			inst.closeWindow(container);
		}, 10000);
	}

	//Fade out the alert window, then close it
	closeWindow(container) {
		container.setAttribute("data-dialog-closing", "true");
		container.style.opacity = "0";
			setTimeout(function () {
				document.body.removeChild(container);
			}, 400);
	}

	//Display the alert window and start the automatic closing
	pushAlertWindow(container) {
		container.setAttribute("data-dialog-closing", "false");
		document.body.appendChild(container);
		this.startAutoDismiss(container);
	}

	//Generate the alert window
	//message: the message to display
	//className: the sub class of alert to add
	//ctAppend (optional): extra element to append
	generateDiv(message, className, ctAppend) {
		var inst = this;
		var container = document.createElement("div");
		container.classList.add("alert");
		container.classList.add(className);
		var closeButton = document.createElement("span");
		closeButton.classList.add("closebtn");
		closeButton.onclick = function () {
			inst.closeWindow(container);
		};
		var textNode = document.createTextNode(message);
		var closeButtonText = document.createTextNode("×");
		closeButton.appendChild(closeButtonText);
		container.appendChild(closeButton);
		container.appendChild(textNode);
		if (ctAppend !== undefined)
		{
			container.appendChild(document.createElement("br"));
			container.appendChild(ctAppend);
		}
		//document.body.appendChild(container);
		return container; //Return the alert window (div)
	}

	//Generate an error alert message
	error(message, ctAppend) {
		return this.generateDiv(message, "error", ctAppend);
	}

	//Generate a warning alert message
	warning(message, ctAppend) {
		return this.generateDiv(message, "warning", ctAppend);
	}

	//Generate an information alert message
	info(message, ctAppend) {
		return this.generateDiv(message, "info", ctAppend);
	}

	//Generate a success alert message
	success(message, ctAppend) {
		return this.generateDiv(message, "success", ctAppend);
	}
}

//Output debugging info to the console
function writeLine(text){
	if (debug) console.log(text);
}

//Detect and probe login forms
function getLoginForms(fill){
	var all = document.getElementsByTagName("*");
	var passFound = false;
	var passField = null;
	var userFound = false;
	var userField = null;

	for (var i=0; i < all.length; i++) { //Loop through all of the elements
		var currentElement = all[i];

		//Password textBox found
		if (currentElement.tagName === "INPUT" && currentElement.type === "password" && !passFound) {
			passField = currentElement;
			passFound = true;
			writeLine("password found");
		}
		else if (!userFound && passFound) //User textBox found
		{
			writeLine("Searching for username field");
			for (var t=i - 1; t >= 0; t--)
			{
				currentElement = all[t];
				if (currentElement.tagName === "INPUT" && currentElement.type === "text")
				{
					userField = currentElement;
					userFound = true;
					writeLine("User field: " + currentElement.name);
					break;
				}
			}

			if (!userFound) {
				writeLine("Username field not found, possible password only login");
				userField = {"value": "no-user"};
				userFound = true;
			} else {
				writeLine("User found");
			}

		}
		else if (currentElement.tagName === "INPUT" && currentElement.type === "submit" && userFound && passFound){
			writeLine("submit button found"); //Submit button found (probe actions here)

			if (fill !== true) { //Not fill mode (site doesn't have a stored password)
				currentElement.addEventListener("click", function(){
					var userName = userField.value;
					var password = passField.value;
					writeLine("Username: " + userName);
					writeLine("Password: " + password);
					pushCredentials(userName, password); //Push credentials to the phone
				});
			}
			else { //Password stored on the phone's DB
				var aw = new AlertWindow(); //New alert window
				//Construct the extra element
				var btn = document.createElement("span");
				btn.appendChild(document.createTextNode("Click Here to fill credentials"));
				btn.classList.add("fillText");
				var alertBox;
				btn.onclick = function () {

					aw.closeWindow(alertBox);
					loadCredentials(function (credentials) { //Load success
						//Fill the credentials
						userField.value = credentials.user;
						passField.value = credentials.pass;
					}, function () { //Load failed
						var errContainer = aw.error("Failed to get credentials");
						aw.pushAlertWindow(errContainer);
					});
				};

				alertBox = aw.info("Credentials Saved for this site!", btn); //Generate the alert window
				aw.pushAlertWindow(alertBox); //Show the alert window on the site
			}

			break;
		}
	}
}

//Load credentials from the phone's DB
function loadCredentials(callbackFunction, failCallback) {
	var initMessage = {
		"req": "get-credentials",
		"url": window.location.href
	};

	//Request credentials
	sendMessage(initMessage, function(response) {
		writeLine("Init message sent for credentials");
	});
	writeLine("Request sent to server");

	//Check for results
	var promise = new Promise(function (resolve, reject) {
		var message = {
			"req": "get-state",
			"url": window.location.href
		};	
		var checkingLoop = setInterval(function () {	
			sendMessage(message, function (response) {
				if (response.status === "done") { //Got result
					clearInterval(checkingLoop);
					resolve({
						"user": response.user,
						"pass": response.pass
					});
				}
				else if (response.status === "fail") { //Failed to get results
					clearInterval(checkingLoop);
					reject();
				}
			});
		}, 5000);
	});

	promise.then(function (credentials) { //Got credentials
		writeLine("Got credentials");
		callbackFunction(credentials);
	}, function () { //Failed to get credentials
		writeLine("Failed to get credentials");
		failCallback();
	});
}

//Store credentials on the phone
function pushCredentials(user, pass){
	var credentials = {
		"url": window.location,
		"user": user,
		"pass": pass,
		"req": "stor"
	};
	//Request the storing of passwords
	sendMessage(credentials, function (response) {
		writeLine("Push response: ");
		writeLine(response);
	});
	writeLine("Credentials sent to temporary storage, waiting for user actions");
}

//Send message to the background script
//message: the text data to send to the server
//callback: the response callback
function sendMessage(message, callback){
	//Setup message filter
	if (message.req !== "stor" && message.req !== "has-credential" && message.req !== "get-state" && message.req !== "get-credentials") return;
	var event = new CustomEvent("fpa_message_passing", {detail: {"msg": message, "func": callback}}); //Create a send event
	window.dispatchEvent(event); //Dispatch the event
}

//Setup sendMessage EventHandler
function setupPageCallback(){
	//Subscribe for sendMessage events
	window.addEventListener("fpa_message_passing", function (eventArgs){
		if (typeof(msg.href) !== "undefined" && msg.href !== window.location.href) return; //Prevent malicious site from requesting credentials
		chrome.runtime.sendMessage(eventArgs.detail.msg, eventArgs.detail.func); //Send mesage to background script
	}, false);
}

var clickedElement;

function bindContextMenu() {
	window.addEventListener("mousedown", function (e) {
		if (e.button == 2) { //Check for Right Click
			clickedElement = e.target;
		}
	}, true);

	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		writeLine("Got request");
	    if(request.cmd == "fpa_set_randomPassword") {
	    	writeLine("Got request to set password");
	        clickedElement.value = request.value;
	    }
	});
}

//Entry point
writeLine("FPA Is Running");
setupPageCallback(); //Setup the sendMessage function
bindContextMenu(); //Handle the click event of generate random password
var checkCreds = {
	"req": "has-credential",
	"url": window.location.href
};
//Check if the site has stored credentials
sendMessage(checkCreds, function (response) {
	getLoginForms(response.result); //Detect and Probe login forms
});