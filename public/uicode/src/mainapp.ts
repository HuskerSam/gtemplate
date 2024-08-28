import Split from "split.js";
import { SemanticTemplate } from "./semantictemplate";
import { RowComponent, TabulatorFull } from 'tabulator-tables';
/** app class for content pages */
export class MainApp {
    tab_info_toggle = document.querySelector('.tab_info_toggle') as HTMLButtonElement;
    semanticTemplate: SemanticTemplate = new SemanticTemplate(this);

    analyze_prompt_button = document.querySelector('.analyze_prompt_button') as HTMLButtonElement;
    analyze_prompt_textarea = document.querySelector('.analyze_prompt_textarea') as HTMLTextAreaElement;
    full_augmented_response = document.querySelector('.full_augmented_response') as HTMLDivElement;
    segment_ui_containers = document.querySelector('.segment_ui_containers') as HTMLDivElement;
    executetab = document.querySelector('#executetab') as HTMLDivElement;
    edittab = document.querySelector('#edittab') as HTMLDivElement;
    historytab = document.querySelector('#historytab') as HTMLDivElement;
    save_template_button = document.querySelector('.save_template_button') as HTMLButtonElement;
    template_editor = document.querySelector('#template_editor') as HTMLDivElement;
    prompt_response_link = document.querySelector('.prompt_response_link') as HTMLAnchorElement;
    note_input = document.querySelector('.note_input') as HTMLInputElement;
    generate_template_button = document.querySelector('.generate_template_button') as HTMLButtonElement;
    generate_source_radios = document.querySelectorAll('input[name="generate_source') as NodeListOf<HTMLInputElement>;
    generate_prompt_instructions = document.querySelector('.generate_prompt_instructions') as HTMLTextAreaElement;
    download_history_button = document.querySelector('.download_history_button') as HTMLButtonElement;
    ui_split: Split.Instance = Split(['.left_ui_panel', '.right_ui_panel'], {
        sizes: [50, 50],
        minSize: [0, 0],
        gutterSize: 5,
        snapOffset: 30,
        direction: 'horizontal',
        cursor: 'col-resize',
    });
    history_split: Split.Instance = Split(['.tabulator_history_list', '#execution_log_viewer'], {
        sizes: [50, 50],
        minSize: [0, 0],
        gutterSize: 5,
        snapOffset: 30,
        direction: 'vertical',
        cursor: 'row-resize',
    });
    generate_split: Split.Instance = Split(['.left_generate_block', '.right_generate_block'], {
        sizes: [50, 50],
        minSize: [0, 0],
        gutterSize: 5,
        snapOffset: 30,
        direction: 'horizontal',
        cursor: 'col-resize',
    });
    tabulatorHistoryList = new TabulatorFull(".tabulator_history_list", {
        layout: "fitColumns",
        selectableRows: 1,
        columns: [{
            title: "",
            field: "delete",
            headerSort: false,
            formatter: () => {
                return `
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  `;
            },
            hozAlign: "center",
            width: 30,
        },
        {
            title: "",
            field: "reuse",
            headerSort: false,
            formatter: () => {
                return `
                    R
                  `;
            },
            hozAlign: "center",
            width: 30,
        },
        { title: "Date", field: "runDate", headerSort: false },
        { title: "Note", field: "note", editor: "input", headerSort: false },
        { title: "Message", field: "message", headerSort: false },
        ],
    });
    analysisRunning = false;
    previousSlimOptions = "";
    lastSlimSelections = "";
    lastResultCache = "";
    selectedHistoryRow = 1;
    historyURLToView = "";

    debouncedInputTimeouts: any = {};
    tabKeys: any = {
        left: 'ArrowLeft',
        right: 'ArrowRight',
    };
    tabDirection: any = {
        "ArrowLeft": -1,
        "ArrowRight": 1,
    };
    editor: any = null;
    logViewer: any = null;

    /** */
    constructor() {
        this.initTabs('[role="tablist"]');
        this.tab_info_toggle.addEventListener('click', () => document.body.classList.toggle('show_tab_info_details'));
        this.historytab.addEventListener('click', async () => {
            this.initLogViewer();
        });
        this.edittab.addEventListener('click', async () => {
            this.initAceEditor();
        });
        this.save_template_button.addEventListener('click', async () => {
            const value = this.editor.session.getValue();
            try {
                const data = JSON.parse(value);
                this.semanticTemplate.promptTemplateString = JSON.stringify(data, null, 2);
                this.saveStorageField("promptTemplateString", this.semanticTemplate.promptTemplateString);
            } catch (e) {
                console.error(e);
                this.semanticTemplate.promptTemplateString = value;
                this.saveStorageField("promptTemplateString", this.semanticTemplate.promptTemplateString);
            }
            this.updateTemplateSaveStatus();
            this.semanticTemplate.initPromptUI();
        });
        this.template_editor.addEventListener('input', async () => {
            setTimeout(() => {
                this.semanticTemplate.promptTemplateString = this.editor.session.getValue();
                this.updateTemplateSaveStatus();
            }, 50);
        });
        this.template_editor.addEventListener('keyup', async () => {
            setTimeout(() => {
                this.semanticTemplate.promptTemplateString = this.editor.session.getValue();
                this.updateTemplateSaveStatus();
            }, 50);
        });
        this.analyze_prompt_button.addEventListener('click', async () => this.semanticTemplate.analyzePrompt());

        this.tabulatorHistoryList.on("cellEdited", async (cell: any) => {
            this.saveStorageField("activityHistory", JSON.stringify(this.tabulatorHistoryList.getData()));
        });
        this.tabulatorHistoryList.on("rowSelectionChanged", async (data: any[], rows: RowComponent[]) => {
            if (data.length > 0) {
                this.historyURLToView = data[0].url;
                this.initLogViewer();
            }
        });
        this.tabulatorHistoryList.on("cellClick", async (e: Event, cell: any) => {
            if (cell.getColumn().getField() === "delete") {
                if (confirm('Are you sure you want to delete this row?')) {
                    this.tabulatorHistoryList.deleteRow(cell.getRow());
                    this.saveStorageField("activityHistory", JSON.stringify(this.tabulatorHistoryList.getData()));
                }
            }
            if (cell.getColumn().getField() === "reuse") {
                let data = cell.getRow().getData();
                this.semanticTemplate.promptTemplateString = JSON.stringify(data.template, null, 2);
                this.editor.session.setValue(this.semanticTemplate.promptTemplateString);
                this.updateTemplateSaveStatus();
                this.semanticTemplate.uiData = data.uiData;
                this.semanticTemplate.initPromptUI();
                
                const html = (<any>window).marked.parse(data.message);
                this.full_augmented_response.innerHTML = html;
            }
        });

        this.generate_template_button.addEventListener('click', async () => {
            this.semanticTemplate.generateTemplate();
        });

        this.download_history_button.addEventListener('click', async () => this.downloadHistory());

        setTimeout(() => {
            this.updateHistoryView();
        }, 50);
    }
    async urlContentToDataUri(url: string) {
        return fetch(url)
            .then(response => response.blob())
            .then(blob => new Promise(callback => {
                let reader = new FileReader();
                reader.onload = function () { callback(this.result) };
                reader.readAsDataURL(blob);
            }));
    }
    fetchTemplateString() {
        return this.readStorageField("promptTemplateString") || JSON.stringify(this.semanticTemplate.defaultData, null, 2);
    }
    safeParse(str: any) {
        try {
            return JSON.parse(str);
        } catch (e) {
            return null;
        }
    }
    updateTemplateSaveStatus() {
        this.save_template_button.classList.remove("btn-ts-secondary");
        this.save_template_button.classList.remove("btn-ts-primary");
        this.save_template_button.classList.remove("btn-ts-warning");
        const currentParse = this.safeParse(this.semanticTemplate.promptTemplateString);
        if (!Array.isArray(currentParse) || currentParse.length === 0) {
            this.save_template_button.classList.add("btn-ts-warning");
            return;
        }
        const currentParseString = JSON.stringify(currentParse);
        const fetchParseString = JSON.stringify(this.safeParse(this.fetchTemplateString()));
        if (currentParseString !== fetchParseString) {
            this.save_template_button.classList.add("btn-ts-primary");
        } else {
            this.save_template_button.classList.add("btn-ts-secondary");
        }
    }
    async getTemplateData(): Promise<any[]> {
        try {
            const data = JSON.parse(this.semanticTemplate.promptTemplateString);
            if (Array.isArray(data)) return data;
        } catch (e) {
            console.error(e);
        }
        return [];
    }
    async initAceEditor() {
        if (this.editor) this.editor.destroy();
        this.editor = (<any>window).ace.edit("template_editor");
        this.editor.setTheme("ace/theme/chrome");
        this.editor.session.setMode("ace/mode/json");
        this.editor.setOption("showPrintMargin", false);

        this.editor.session.setValue("hidePageBreak", true);
        this.editor.session.setValue(this.semanticTemplate.promptTemplateString);
    }
    async initLogViewer() {
        if (this.logViewer) this.logViewer.destroy();
        this.logViewer = (<any>window).ace.edit("execution_log_viewer");
        this.logViewer.setTheme("ace/theme/chrome");
        this.logViewer.session.setMode("ace/mode/json");
        this.logViewer.setOption("showPrintMargin", false);
        if (this.historyURLToView) {
            const response = await fetch(this.historyURLToView);
            const data = await response.json();
            this.logViewer.session.setValue(JSON.stringify(data, null, 2));
        } else {
            this.logViewer.session.setValue("No history selected.");
        }

        this.logViewer.setReadOnly(true);
    }
    attachEvents(tabs: any[]) {
        tabs.forEach((tab, index) => {
            tab.addEventListener('keyup', (e: KeyboardEvent) => {
                if (e.code === this.tabKeys.left || e.code === this.tabKeys.right) {
                    this.switchTabOnArrowPress(e, tabs);
                }
            });

            tab.addEventListener('click', (e: Event) => {
                e.preventDefault();
                this.setActiveTab(tab, tabs);
            });

            tab.addEventListener('focus', () => {
                this.setActiveTab(tab, tabs);
            });

            tab.index = index;
        });
    }
    setActiveTab(tab: any, tabs: any[]) {
        tabs.forEach((tabElement: HTMLDivElement) => {
            const tabContent = document.getElementById(tabElement.getAttribute('aria-controls') as string) as HTMLElement;

            if (tabElement === tab) {
                tabElement.setAttribute('aria-selected', "true");
                tabContent.removeAttribute('hidden');
            } else {
                tabElement.setAttribute('aria-selected', "false");
                tabContent.setAttribute('hidden', "true");
            }
        });
    }
    initTabs(selector: string) {
        var tabContainers = [].slice.call(document.querySelectorAll(selector));

        tabContainers.forEach((tabContainer: HTMLElement) => {
            const tabs = [].slice.call(tabContainer.querySelectorAll('[aria-controls]'));
            this.attachEvents(tabs);
        });
    }
    switchTabOnArrowPress(e: KeyboardEvent, tabs: any[]) {
        const pressed = e.code as string;

        if (this.tabDirection[pressed]) {
            const target = e?.target as any;
            if (target.index !== undefined) {
                if (tabs[target.index + this.tabDirection[pressed]]) {
                    tabs[target.index + this.tabDirection[pressed]].focus();
                } else if (pressed === this.tabKeys.left) {
                    tabs[tabs.length - 1].focus();
                } else if (pressed === this.tabKeys.right) {
                    tabs[0].focus();
                }
            }
        }
    }
    saveStorageField(field: string, value: string) {
        localStorage.setItem(field, value);
    }
    readStorageField(field: string) {
        return localStorage.getItem(field);
    }
    updateHistoryView() {
        const activityHistory: any[] = this.safeParse(this.readStorageField("activityHistory")) || [];
        this.tabulatorHistoryList.setData(activityHistory);
        if (activityHistory.length > 0) {
            this.tabulatorHistoryList.selectRow(this.tabulatorHistoryList.getRowFromPosition(1))
        }
    }
    downloadHistory() {
        const activityHistory: any[] = this.safeParse(this.readStorageField("activityHistory")) || [];
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activityHistory));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("target", "_blank");
        downloadAnchorNode.setAttribute("download", "activity_history.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
    clearHistory() {
        if (confirm('Are you sure you want to clear your history?')) {
            localStorage.removeItem("activityHistory");
            this.updateHistoryView();
        }
    }
}
