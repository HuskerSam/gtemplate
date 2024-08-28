import {
    MainApp,
} from "./src/mainapp";
import {
    initializeApp,
} from "firebase/app";

window.addEventListener("load", async () => {
    const response = await fetch("/__/firebase/init.json");
    const config = await response.json();
    initializeApp(config);
    (<any>window).AppInstance = new MainApp();
});
