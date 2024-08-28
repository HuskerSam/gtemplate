/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {
    onRequest,
} from "firebase-functions/v2/https";
import {
    initializeApp,
} from "firebase-admin/app";
import {
    GoogleAuth,
} from "google-auth-library";
initializeApp();

export const getToken = onRequest(async (request: any, response: any) => {
    const googleAuth = new GoogleAuth({
        scopes: "https://www.googleapis.com/auth/cloud-platform",
    });

    const client = await googleAuth.getClient();
    const token = await client.getAccessToken();
    response.send(token.token);
});
