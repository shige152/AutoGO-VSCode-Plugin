// Ensure this script runs only after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // eslint-disable-next-line no-undef
    const vscode = acquireVsCodeApi();
    const WEBVIEW_DEBUG = false;
    const debugLog = WEBVIEW_DEBUG ? console.log.bind(console) : (..._args) => undefined;

    // --- State Variables ---
    let customCommands = [];
    let customFiles = [];
    let customUrls = [];
    let editingIndex = null; // To track which item is being edited (null for add)
    let editingType = null; // To track which list type is being edited ('commands', 'files', 'urls')

    // --- DOM Element References ---
    const adbPathInput = document.getElementById('adbPath');
    const browseButton = document.getElementById('browseButton');
    const installAdbButton = document.getElementById('installAdbButton');
    const packsoCheckbox = document.getElementById('packsoEnabled');
    const codeObfuscationCheckbox = document.getElementById('codeObfuscationEnabled');
    const showLogTimeCheckbox = document.getElementById('showLogTime');
    const showContextMenuCheckbox = document.getElementById('showContextMenu');
    const saveButton = document.getElementById('saveButton');
    const cancelButton = document.getElementById('cancelButton');
    const updateAutoGoButton = document.getElementById('updateAutoGoButton');
    const navButtons = document.querySelectorAll('.nav-item[data-section]');
    const settingsSections = document.querySelectorAll('.settings-section');

    // Custom Command Elements
    const commandsListDiv = document.getElementById('customCommandsList');
    // const addCommandForm = document.getElementById('addCommandForm'); // Form div itself might not be needed directly
    const newCommandLabelInput = document.getElementById('newCommandLabel');
    const newCommandValueInput = document.getElementById('newCommandValue');
    const addCommandButton = document.getElementById('addCommandButton');

    // Custom File Elements
    const filesListDiv = document.getElementById('customFilesList');
    // const addFileForm = document.getElementById('addFileForm');
    const newFileLabelInput = document.getElementById('newFileLabel');
    const newFilePathInput = document.getElementById('newFilePath');
    const addFileButton = document.getElementById('addFileButton');

    // Custom URL Elements
    const urlsListDiv = document.getElementById('customUrlsList');
    // const addUrlForm = document.getElementById('addUrlForm');
    const newUrlLabelInput = document.getElementById('newUrlLabel');
    const newUrlValueInput = document.getElementById('newUrlValue');
    const addUrlButton = document.getElementById('addUrlButton');

    // --- Functions ---
    function setActiveSection(sectionId) {
        settingsSections.forEach((section) => {
            const match = section.id === `section-${sectionId}`;
            section.classList.toggle('is-active', match);
        });

        navButtons.forEach((button) => {
            const match = button.dataset.section === sectionId;
            button.classList.toggle('is-active', match);
        });
    }

    // Generic function to render a list of custom items
    function renderList(type, items, listDiv) {
        listDiv.innerHTML = ''; // Clear current list

        if (!Array.isArray(items)) {
            // Use string concatenation to avoid potential linter issues with backticks
            console.error('Invalid items for type ' + type + ':', items);
            vscode.postMessage({ command: 'error', text: 'Error rendering ' + type + ' list: Invalid data.' });
            return;
        }


        items.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('list-item');
            // Add data attribute to easily find the item later if needed
            itemDiv.dataset.index = index;
            itemDiv.dataset.type = type;

            const labelSpan = document.createElement('span');
            labelSpan.classList.add('item-label');
            labelSpan.textContent = item.label;

            const valueSpan = document.createElement('span');
            valueSpan.classList.add('item-value');
            // Determine the value based on the type
            const valueText = type === 'commands' ? item.command : type === 'files' ? item.path : item.url;
            valueSpan.textContent = valueText;

            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('item-actions');

            const editButton = document.createElement('button');
            editButton.textContent = '编辑';
            editButton.type = 'button'; // Ensure it's not treated as a submit button
            editButton.addEventListener('click', () => startEdit(type, index));

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '删除';
            deleteButton.type = 'button';
            deleteButton.addEventListener('click', () => deleteItem(type, index));

            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);

            itemDiv.appendChild(labelSpan);
            itemDiv.appendChild(valueSpan);
            itemDiv.appendChild(actionsDiv);

            listDiv.appendChild(itemDiv);
        });
    }

    // Add or Update an item
    function addOrUpdateItem(type) {
        let labelInput, valueInput, itemsArray, addButton, listDiv;

        // Determine which set of inputs/arrays to use based on type
        switch (type) {
            case 'commands':
                labelInput = newCommandLabelInput;
                valueInput = newCommandValueInput;
                itemsArray = customCommands;
                addButton = addCommandButton;
                listDiv = commandsListDiv;
                break;
            case 'files':
                labelInput = newFileLabelInput;
                valueInput = newFilePathInput;
                itemsArray = customFiles;
                addButton = addFileButton;
                listDiv = filesListDiv;
                break;
            case 'urls':
                labelInput = newUrlLabelInput;
                valueInput = newUrlValueInput;
                itemsArray = customUrls;
                addButton = addUrlButton;
                listDiv = urlsListDiv;
                break;
            default:
                console.error('Invalid type passed to addOrUpdateItem:', type);
                return;
        }

        const label = labelInput.value.trim();
        const value = valueInput.value.trim();

        // Basic validation
        if (!label || !value) {
            vscode.postMessage({ command: 'error', text: '名称和值不能为空！' });
            // Maybe add a visual indication near the inputs
            return;
        }

        // Create the new item object based on type
        const newItem = type === 'commands' ? { label, command: value } :
            type === 'files' ? { label, path: value } :
                { label, url: value };

        // Check for duplicate labels before adding/updating
        // Allows same label if editing the item with that label
        const duplicateIndex = itemsArray.findIndex((item, idx) => item.label === label && idx !== editingIndex);

        if (duplicateIndex !== -1) {
            // Use string concatenation
            vscode.postMessage({ command: 'error', text: '已存在名为 \"' + label + '\" 的项！' });
            return;
        }


        if (editingIndex !== null && editingType === type) {
            // Update existing item in the array
            debugLog('Updating item at index', editingIndex, 'with', newItem);
            itemsArray[editingIndex] = newItem;
        } else {
            // Add new item to the array
            debugLog('Adding new item:', newItem);
            itemsArray.push(newItem);
        }

        // Reset editing state and clear the form for this type
        cancelEdit(type);
        // Re-render the list for this type
        renderList(type, itemsArray, listDiv);
    }

    // Delete an item
    function deleteItem(type, index) {
        let itemsArray, listDiv;
        switch (type) {
            case 'commands': itemsArray = customCommands; listDiv = commandsListDiv; break;
            case 'files': itemsArray = customFiles; listDiv = filesListDiv; break;
            case 'urls': itemsArray = customUrls; listDiv = urlsListDiv; break;
            default: return;
        }

        if (index >= 0 && index < itemsArray.length) {
            debugLog('Deleting', type, 'item at index', index);
            // If deleting the item currently being edited, cancel edit first
            if (editingIndex === index && editingType === type) {
                cancelEdit(type);
            }
            // Remove the item from the array
            itemsArray.splice(index, 1);
            // Re-render the list
            renderList(type, itemsArray, listDiv);

            // --- Important: Adjust editingIndex if necessary ---\n            // If an item *before* the one being edited was deleted, decrement editingIndex
            if (editingIndex !== null && editingType === type && index < editingIndex) {
                debugLog('Adjusting editing index from', editingIndex, 'to', editingIndex - 1);
                editingIndex--;
            }
            // If the item being edited *itself* was deleted (should be covered by cancelEdit),\n            // ensure editingIndex is null. cancelEdit should handle this.
        } else {
            console.error('Invalid index for deletion:', index, 'in array:', itemsArray);
        }
    }

    // Start editing an item
    function startEdit(type, index) {
        let labelInput, valueInput, itemsArray, addButton;
        switch (type) {
            case 'commands':
                labelInput = newCommandLabelInput; valueInput = newCommandValueInput; itemsArray = customCommands; addButton = addCommandButton;
                break;
            case 'files':
                labelInput = newFileLabelInput; valueInput = newFilePathInput; itemsArray = customFiles; addButton = addFileButton;
                break;
            case 'urls':
                labelInput = newUrlLabelInput; valueInput = newUrlValueInput; itemsArray = customUrls; addButton = addUrlButton;
                break;
            default: return;
        }

        if (index >= 0 && index < itemsArray.length) {
            debugLog('Starting edit for', type, 'at index', index);
            // Cancel any other ongoing edit first
            if (editingIndex !== null && editingType !== null && (editingIndex !== index || editingType !== type)) {
                debugLog('Cancelling previous edit for', editingType);
                cancelEdit(editingType);
            }

            const item = itemsArray[index];
            // Populate the form for this type
            labelInput.value = item.label;
            valueInput.value = type === 'commands' ? item.command : type === 'files' ? item.path : item.url;

            // Set editing state
            editingIndex = index;
            editingType = type;
            addButton.textContent = '更新'; // Change button text
            labelInput.focus(); // Focus on the label input for easy editing
        } else {
            console.error('Invalid index for editing:', index, 'in array:', itemsArray);
        }
    }

    // Cancel editing state for a specific type
    function cancelEdit(type) {
        let labelInput, valueInput, addButton;
        switch (type) {
            case 'commands': labelInput = newCommandLabelInput; valueInput = newCommandValueInput; addButton = addCommandButton; break;
            case 'files': labelInput = newFileLabelInput; valueInput = newFilePathInput; addButton = addFileButton; break;
            case 'urls': labelInput = newUrlLabelInput; valueInput = newUrlValueInput; addButton = addUrlButton; break;
            default: return; // Don't reset if type is unknown or null
        }

        debugLog('Cancelling edit for type:', type);
        // Clear the specific form
        labelInput.value = '';
        valueInput.value = '';

        // Only reset global editing state if it matches the type being cancelled
        if (editingType === type) {
            editingIndex = null;
            editingType = null;
        }
        // Always reset the button text for this type
        addButton.textContent = '添加';
    }


    // --- Event Listeners ---

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data; // The JSON data sent from the extension
        debugLog('Message received from extension:', message);

        switch (message.command) {
            case 'loadSettings':
                const settings = message.payload;
                debugLog('Loading settings into UI:', settings);

                // --- Load Basic Settings ---
                if (adbPathInput) adbPathInput.value = settings.adbPath || '';
                if (packsoCheckbox) packsoCheckbox.checked = settings.packso || false;
                if (codeObfuscationCheckbox) codeObfuscationCheckbox.checked = settings.codeObfuscation || false;
                // Default showLogTime to true if undefined
                if (showLogTimeCheckbox) showLogTimeCheckbox.checked = settings.showLogTime === undefined ? true : settings.showLogTime;
                // Default showContextMenu to true if undefined
                if (showContextMenuCheckbox) showContextMenuCheckbox.checked = settings.showContextMenu === undefined ? true : settings.showContextMenu;

                // Load APK Architectures
                const archCheckboxes = document.querySelectorAll('input[name=\"apkArchitectures\"]');
                if (settings.apkArchitectures) {
                    archCheckboxes.forEach(checkbox => {
                        // Ensure checkbox is an HTMLInputElement before accessing value/checked
                        if (checkbox instanceof HTMLInputElement) {
                            checkbox.checked = settings.apkArchitectures[checkbox.value] === true;
                        }
                    });
                } else {
                    console.warn('apkArchitectures setting is missing or invalid.');
                    // Optionally set defaults or show error
                }

                // --- Load Custom Items ---
                // Ensure we have arrays, even if settings are missing/null
                customCommands = Array.isArray(settings.customCommands) ? settings.customCommands : [];
                customFiles = Array.isArray(settings.customFiles) ? settings.customFiles : [];
                customUrls = Array.isArray(settings.customUrls) ? settings.customUrls : [];

                // Render lists
                if (commandsListDiv) renderList('commands', customCommands, commandsListDiv);
                if (filesListDiv) renderList('files', customFiles, filesListDiv);
                if (urlsListDiv) renderList('urls', customUrls, urlsListDiv);
                break;

            case 'adbPathSelected':
                debugLog('Received adbPathSelected:', message.path);
                if (adbPathInput) adbPathInput.value = message.path;
                break;
            case 'adbInstallResult':
                if (installAdbButton) {
                    installAdbButton.disabled = false;
                    installAdbButton.textContent = '自动下载';
                }
                if (message.ok) {
                    if (adbPathInput) adbPathInput.value = message.path || '';
                } else {
                    console.error('ADB download failed:', message.message);
                }
                break;

            case 'saveError':
                // Display error message to the user in the webview
                console.error("Save Error:", message.message);
                // You could add a div to the HTML to show errors, e.g.:
                // const errorDiv = document.getElementById('errorMessages'); // Add this div to your HTML
                // if(errorDiv) errorDiv.textContent = '保存失败: ' + message.message; // Use string concatenation
                break;

            default:
                debugLog('Received unknown message command:', message.command);
        }
    });

    // Browse for ADB Path
    if (browseButton) {
        browseButton.addEventListener('click', () => {
            debugLog('Browse ADB path button clicked');
            vscode.postMessage({ command: 'browseAdbPath' });
        });
    } else {
        console.error('Browse button not found');
    }

    if (installAdbButton) {
        installAdbButton.addEventListener('click', () => {
            if (installAdbButton.disabled) {
                return;
            }
            installAdbButton.disabled = true;
            installAdbButton.textContent = '下载中...';
            vscode.postMessage({ command: 'installAdb' });
        });
    } else {
        console.error('Install ADB button not found');
    }


    // Cancel Button
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            debugLog('Cancel button clicked');
            vscode.postMessage({ command: 'closePanel' });
        });
    } else {
        console.error('Cancel button not found');
    }

    // Update AutoGo Button
    if (updateAutoGoButton) {
        updateAutoGoButton.addEventListener('click', () => {
            debugLog('Update AutoGo button clicked');
            vscode.postMessage({ command: 'updateAutoGo' });
        });
    } else {
        console.error('Update AutoGo button not found');
    }

    // Save Button (OK Button)
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            debugLog('Save button clicked');
            // Cancel any ongoing edit first to ensure data consistency
            if (editingIndex !== null && editingType !== null) {
                cancelEdit(editingType);
            }

            // --- Gather Basic Settings ---
            const adbPath = adbPathInput ? adbPathInput.value : '';
            const packso = packsoCheckbox ? packsoCheckbox.checked : false;
            const codeObfuscation = codeObfuscationCheckbox ? codeObfuscationCheckbox.checked : false;
            const showLogTime = showLogTimeCheckbox ? showLogTimeCheckbox.checked : true;
            const showContextMenu = showContextMenuCheckbox ? showContextMenuCheckbox.checked : true;

            // Gather APK Architectures
            const apkArchitectures = {};
            const archCheckboxes = document.querySelectorAll('input[name=\"apkArchitectures\"]');
            archCheckboxes.forEach(checkbox => {
                if (checkbox instanceof HTMLInputElement) {
                    apkArchitectures[checkbox.value] = checkbox.checked;
                }
            });

            // --- Gather Custom Items ---
            // The customCommands, customFiles, customUrls arrays are already up-to-date through add/edit/delete operations

            // --- Construct Payload ---
            const payload = {
                adbPath,
                packso,
                codeObfuscation,
                apkArchitectures,
                showLogTime,
                showContextMenu,
                customCommands, // Send the current state of the arrays
                customFiles,
                customUrls
            };

            debugLog('Sending saveAllSettings message with payload:', payload);
            vscode.postMessage({ command: 'saveAllSettings', payload: payload });
        });
    } else {
        console.error('Save button not found');
    }


    // Add/Update Buttons for Custom Items
    if (addCommandButton) {
        addCommandButton.addEventListener('click', () => addOrUpdateItem('commands'));
    } else {
        console.error('Add Command button not found');
    }

    if (addFileButton) {
        addFileButton.addEventListener('click', () => addOrUpdateItem('files'));
    } else {
        console.error('Add File button not found');
    }

    if (addUrlButton) {
        addUrlButton.addEventListener('click', () => addOrUpdateItem('urls'));
    } else {
        console.error('Add URL button not found');
    }

    if (navButtons.length > 0) {
        navButtons.forEach((button) => {
            button.addEventListener('click', () => {
                if (button.dataset.section) {
                    setActiveSection(button.dataset.section);
                }
            });
        });

        const initialButton = document.querySelector('.nav-item.is-active') || navButtons[0];
        if (initialButton && initialButton.dataset.section) {
            setActiveSection(initialButton.dataset.section);
        }

        vscode.postMessage({ command: 'webviewReady' });
    }

    debugLog('Settings panel script initialized.');
});
