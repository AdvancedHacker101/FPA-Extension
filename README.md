# FPA-Extension
Thank you for checking out this project!  
This is a browser extension, which allows you to store passwords and retrieve them using your phone with a fingerprint sensor.  
## Storing Passwords
It works like just a normal password manager.  
First it tries to detect login forms and store the login credentials in the browser's RAM. At this point credentials are called `pending`.  
Then you can decide which credentials to add and which credentials to remove!  
When you add a credential the browser will show up a QR Code using the [Native App](https://github.com/AdvancedHacker101/FPA-NativeApp). You have to scan this code with the `Android App`, and the password will be stored on your phone.  
## Filling login forms
When you have stored credentials for a website, the extension will prompt you if you want to fill them!  
If you accept the prompt another QR Code comes up, you have to scan it with the `Android App`, and then touch the fingerprint sensor.  
Then the extension will fill the required credentials, and you can just press the login button.  
## Installation
The project is currently in development stage, so regular users may need to check back later for this extension, but you're feel free to load it in chrome.  
1. Fork the project
2. Open up `chrome` and go to the extension page (click the `3 dots` > `More Tools` > `Extensions`).
3. Tick the `developer mode` checkbox
4. Click `Load unpacked extension...` and select the forked folder  

That's it, you now have the extension.  
**Note**: the extension requires that you have the `Android App` on your phone and the [Native App](https://github.com/AdvancedHacker101/FPA-NativeApp) on your computer!
## Development Notes
* `Android App` isn't yet on github, so you have to wait until then.
* Working with chrome, not tested with other browsers  
  * It may work with firefox, but I don't exactly remember if they use the same engine for extensions.  
  * For edge, if I remember correctly I have to use a separate compiler to convert the chrome extension to an edge extension  
  * Support for IE isn't planned, but we'll see how this goes.
