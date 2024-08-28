import { MainApp } from "./mainapp";
const LOCATION = 'us-central1';
const MODEL_ID = 'gemini-1.5-pro-001';
import { getStorage, ref, uploadBytes } from "firebase/storage";


export class SemanticTemplate {
    app: MainApp;
    appConfig: any = null;
    uiData: any = {};
    defaultData: any = null;
    promptTemplateString = "";
    running = false;
    uiLoading = false;

    constructor(app: MainApp) {
        this.app = app;
        this.load();
    }
    async load() {
        const response = await fetch("/__/firebase/init.json");
        this.appConfig = await response.json();
        const dataQuery = await fetch("/default.json");
        this.defaultData = await dataQuery.json();

        this.uiData = this.app.safeParse(this.app.readStorageField("uiData")) || {};
        this.promptTemplateString = this.app.fetchTemplateString();
        this.initPromptUI();
    }
    async processPromptWithAPI(parts: any[]): Promise<any> {
        const ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${this.appConfig.projectId}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:generateContent`;

        let resultMessage = 'unknown error';
        let promptResult: any = {};
        let error = true;
        try {
            const rawBody = {
                generationConfig: {
                    'maxOutputTokens': 8192,
                    'temperature': 1,
                    'topP': 0.95,
                },
                safetySettings: [{
                    'category': 'HARM_CATEGORY_HATE_SPEECH',
                    'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
                },
                {
                    'category': 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
                },
                {
                    'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
                },
                {
                    'category': 'HARM_CATEGORY_HARASSMENT',
                    'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
                }],
                contents: [{
                    role: 'user',
                    parts
                }],
            };
            const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${await this.getToken()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(rawBody),
            });

            const json = await response.json();
            console.log(json);
            resultMessage = json.candidates[0].content.parts[0].text;
            return {
                resultMessage,
                promptResult,
                error,
            }
        } catch (err: any) {
            return {
                resultMessage,
                promptResult,
                error: err,
            }
        }
    }
    async getToken() {
        const response = await fetch(window.location + '/getToken');
        return await response.text();
    }
    appendUserFileTemplate(segment: any) {
        const description = segment.description || "Select a file:";
        const cardHTML = `<div class="inline-block border border-secondary rounded p-1 whitespace-nowrap overflow-hidden">
        <div class="mr-[-150px]">
                <span class="font-bold text-blue-600 text-sm mr-2">${segment.segment}</span>
                ${description} <span class="moniker">{${segment.moniker}}</span>
                </div>
                <input class="file_input hidden" type="file">
                <div class="inline-block">
                    <div class="whitespace-nowrap">
                        File Url: <input class="file_input_path inline-block w-[15em]" type="text">
                    </div>
                    <div class="whitespace-nowrap">
                        Mime Type: <input class="file_input_mime inline-block w-10" type="text">
                    </div>
                </div>
                <button class="file_input_button btn btn-ts-secondary">Upload</button>
              </div>`;
        const div = document.createElement('div');
        div.setAttribute('class', 'template_ui_data_item');
        div.innerHTML = cardHTML;

        const file_input_path = div.querySelector('.file_input_path') as HTMLInputElement;
        const file_input_mime = div.querySelector('.file_input_mime') as HTMLInputElement;
        
        file_input_path.value = this.uiData[segment.moniker + "_url"] || "";
        file_input_mime.value = this.uiData[segment.moniker + "_mime"] || "";
        file_input_path.addEventListener('input', () => {
            this.uiData[segment.moniker + "_url"] = file_input_path.value;
            this.app.saveStorageField("uiData", JSON.stringify(this.uiData));
        });
        file_input_mime.addEventListener('input', () => {
            this.uiData[segment.moniker + "_mime"] = file_input_mime.value;
            this.app.saveStorageField("uiData", JSON.stringify(this.uiData));
        });

        let ignoreChange = true;
        const file_input = div.querySelector('.file_input') as HTMLInputElement;
        file_input.addEventListener('change', async () => {
            if (this.uiLoading || ignoreChange) return;
            if (!file_input.files || !file_input.files[0]) return;
            file_input_mime.value = file_input.files[0].type;
            file_input_mime.dispatchEvent(new Event('input'));
            file_input_path.value = "";
            this.uploadFile(file_input.files[0].name, file_input.files[0]).then((url) => {
                file_input_path.value = url;
                file_input_path.dispatchEvent(new Event('input'));
            });
        });

        const file_input_button = div.querySelector('.file_input_button') as HTMLButtonElement;
        file_input_button.addEventListener('click', async () => {
            ignoreChange = false;
            file_input.click();
        });

        this.app.segment_ui_containers.appendChild(div);
    }
    appendUserInstructionTemplate(segment: any) {
        const description = segment.description || "Select a file:";
        const cardHTML = `<div class="inline-block border border-secondary rounded p-1 whitespace-nowrap">
        <div>
                <span class="font-bold text-blue-600 text-sm mr-2">${segment.segment}</span>
                ${description} <span class="moniker">{${segment.moniker}}</span>
                </div>
            <textarea class="analyze_prompt_textarea m-1"
              placeholder="user instructions"
              type="text"></textarea>
        </div>`;
        const div = document.createElement('div');
        div.classList.add('template_ui_data_item');
        div.innerHTML = cardHTML;
        this.app.segment_ui_containers.appendChild(div);

        const analyze_prompt_textarea = div.querySelector('.analyze_prompt_textarea') as HTMLTextAreaElement;
        analyze_prompt_textarea.addEventListener('input', () => {
            this.uiData[segment.moniker] = analyze_prompt_textarea.value;
            this.app.saveStorageField("uiData", JSON.stringify(this.uiData));
        });
        analyze_prompt_textarea.value = this.uiData[segment.moniker] || "";
    }
    async uploadFile(fileName: string, file: any, prefix = "user") {
        const storage = getStorage();
        const fileRef = ref(storage, `templateDemo/${prefix}/${new Date().toISOString()}/${fileName}`);
        const result = await uploadBytes(fileRef, file);
        console.log(result);
        //const url = result.ref.fullPath;
        const url = `https://firebasestorage.googleapis.com/v0/b/${this.appConfig.projectId}.appspot.com/o/${encodeURIComponent(result.ref.fullPath)}?alt=media`;
        return url;
    }
    async initPromptUI() {
        this.app.full_augmented_response.innerHTML = "";
        this.app.segment_ui_containers.innerHTML = "";

        const currentParse = this.app.safeParse(this.promptTemplateString);
        this.uiLoading = true;
        if (Array.isArray(currentParse)) {
            currentParse.forEach((segment: any) => {
                if (segment.segment === "userFile") {
                    this.appendUserFileTemplate(segment);
                } else if (segment.segment === "userInstruction") {
                    this.appendUserInstructionTemplate(segment);
                }
            });
        }
        this.uiLoading = false;
    }
    async analyzePrompt() {
        if (this.running) {
            if (!confirm("Already running - stop previous and run again?")) {
                return;
            }
        }
        this.running = true;
        this.app.full_augmented_response.innerHTML = "running...";
        this.app.analyze_prompt_button.classList.remove("btn-ts-primary");
        this.app.analyze_prompt_button.classList.add("btn-ts-secondary");
        const templateData = await this.app.getTemplateData();
        const promises: any[] = [];

        const getFile = async (segment: any) => {
            const rawData = await this.app.urlContentToDataUri(this.uiData[segment.moniker + "_url"]) as string;
            return {
                inlineData: {
                    data: rawData.split(",")[1],
                    mimeType: this.uiData[segment.moniker + "_mime"],
                },
            };
        }

        templateData.forEach((segment: any) => {
            if (segment.segment === "userFile") {
                return promises.push(getFile(segment));
            }
            //else if (segment.segment === "userInstruction") {
            return promises.push({
                text: this.uiData[segment.moniker],
            });
        });
        const parts = await Promise.all(promises);
        const result = await this.processPromptWithAPI(parts);

        const historyEntry = {
            type: "promptResult",
            runDate: new Date().toISOString().substring(0, 19),
            template: templateData,
            uiData: this.uiData,
            fullResult: result,
            message: result.resultMessage,
            runNote: this.app.note_input.value,
        };
        const html = (<any>window).marked.parse(result.resultMessage);
        this.app.full_augmented_response.innerHTML = html;
        const historyUrl = await this.uploadFile("history.json", new Blob([JSON.stringify(historyEntry, null, 2)], { type: 'application/json' }), "history");

        this.app.prompt_response_link.innerHTML = historyUrl;
        this.app.prompt_response_link.href = historyUrl;
        const activityHistory: any[] = this.app.safeParse(this.app.readStorageField("activityHistory")) || [];
        activityHistory.unshift({
            type: "promptResult",
            url: historyUrl,
            runDate: historyEntry.runDate,
            message: historyEntry.message,
            note: this.app.note_input.value,
        });
        this.app.saveStorageField("activityHistory", JSON.stringify(activityHistory));
        this.app.analyze_prompt_button.classList.add("btn-ts-primary");
        this.app.analyze_prompt_button.classList.remove("btn-ts-secondary");

        this.app.updateHistoryView();
        this.running = false;
    }
    async generateTemplate() {
        let sourceTemplate = "default";
        this.app.generate_source_radios.forEach((radio) => {
            if (radio.checked) {
                sourceTemplate = radio.value;
            }
        });

        const startingTemplate = (sourceTemplate === "default") ?
            JSON.stringify(this.defaultData, null, 2) :
            this.app.fetchTemplateString();

        const userInstructions = this.app.generate_prompt_instructions.value;

        let prompt = `Please generate a json (and only json) template based on the following instructions:\nBEGIN INSTRUCTIONS\n${userInstructions}\nEND INSTRUCTIONS\n`;
        prompt += `Use the following template as a reference:\n\n${startingTemplate}`;

        const parts = [{
            text: prompt,
        }];
        const result = await this.processPromptWithAPI(parts);
        const historyEntry = {
            type: "generateTemplate",
            runDate: new Date().toISOString().substring(0, 19),
            sourceTemplate,
            userInstructions,
            fullResult: result,
            message: result.resultMessage,
        };
        const html = (<any>window).marked.parse(result.resultMessage);
        this.app.full_augmented_response.innerHTML = html;
        const historyUrl = await this.uploadFile("history.json", new Blob([JSON.stringify(historyEntry, null, 2)], { type: 'application/json' }), "history");
        const activityHistory: any[] = this.app.safeParse(this.app.readStorageField("activityHistory")) || [];
        activityHistory.unshift({
            type: "generateTemplate",
            url: historyUrl,
            runDate: historyEntry.runDate,
            message: historyEntry.message,
        });
        this.app.saveStorageField("activityHistory", JSON.stringify(activityHistory));

        this.app.updateHistoryView();
        let template = historyEntry.message;
        template = template.replace("```json", "");
        template = template.replaceAll("```", "");
        this.app.editor.session.setValue(template);
        this.app.save_template_button.click();
    }
}