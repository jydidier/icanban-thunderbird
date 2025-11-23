/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** TODO Organize extension in a more modular way */

import './i18n.js';

import * as JCAL from './jcal.js';
import {marked} from '../vendor/marked.esm.js';

let mc = (globalThis.messenger !== undefined) ?
    messenger.calendar:(await import('./calendar_front.js'));

let filter = {};
let sort = null;
let capability = {};
let compact = {mode : false};
const categories = new Set();


/* HELPER FUNCTIONS */
let setStorage = async (key, value) => {
    if( globalThis.browser !== undefined) {
        let obj = {};
        obj[key] = value;
        await browser.storage.local.set(obj);
    } else {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

let getStorage = async (key) => {
    if (globalThis.browser !== undefined) {
        let obj = await browser.storage.local.get(key);
        return obj[key];
    } else {
        return JSON.parse(localStorage.getItem(key));
    }
};

/* CONVERSION OF AN ITEM AS A TODO COMPONENT */

const asTodo = (item) => {
    if (item.formats){
        const cmp = new JCAL.Component(item.formats.jcal);
        return cmp.first('vtodo');
    }
    if (item.format === 'jcal') {
        const cmp = new JCAL.Component(item.item);
        return cmp.first('vtodo');
    }
    return null;
};

/* DRAG'N DROP SETUP */
let dragover = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
}

let drop = async (event) => {
    event.preventDefault();
    //console.log('dropped',event);
    let target = event.target;
    if (event.target.nodeName === "DIV") {
        target = event.target.querySelector('.kanban-list');
    } 

    if (target.classList.contains('kanban-list')) {
        let data = JSON.parse(event.dataTransfer.getData("text/plain"));
        /* necessary as an instant feedback for the user */
        target.appendChild(document.getElementById(data.id));
        let cmp = await mc.items.get(data.calendarId, data.id, { returnFormat: "jcal" });
        let jtodo = asTodo(cmp);
        jtodo.status = target.id;
        if (jtodo.status === "COMPLETED") { 
            jtodo.percentComplete = 100; 
        } else { 
            jtodo.percentComplete = 0; 
            jtodo.completed=undefined;
        }
        await mc.items.update(data.calendarId, data.id, { format: "jcal", item: jtodo.data });
    }
};

/* it is now related to columns */ 
let kanbanLists = document.getElementsByClassName("kanban-list");
for (let i=0; i <kanbanLists.length; i++) {
    kanbanLists[i].parentElement.addEventListener("drop",drop);
    kanbanLists[i].parentElement.addEventListener("dragover", dragover);
}


/* Compact mode setup */

const compactModeSwitch = document.getElementById('compactModeSwitch');

let toggleAllCollapse = function(status) {
    document.querySelectorAll('.card-text').forEach(node => {
        if (status) {
            node.classList.replace('collapse.show','collapse')
        } else {
            node.classList.replace('collapse','collapse.show');
        }
    });
}

if (compactModeSwitch) {
    compactModeSwitch.addEventListener('change', async (evt) => {
        let selfChecked = evt.target.checked;
        await setStorage("icanban-compact-mode", { mode: selfChecked });
        toggleAllCollapse(selfChecked);
    });
}


/* Modal setup for task edition */
const taskModal = document.getElementById('taskModal');
const saveTaskButton = document.getElementById('saveTask');

const saveTask = async (evt) => {
    //  here, we must add some controls
    let form = document.getElementById('taskForm');
    if (!form.checkValidity()) {
        evt.preventDefault();
        evt.stopPropagation();
        alert(browser.i18n.getMessage('alertTask'));
        return;
    }


    let title = document.getElementById('taskTitle').value;
    let description = document.getElementById('taskDescription').value;
    let startDate = document.getElementById('taskStartDate').value;
    let dueDate = document.getElementById('taskDueDate').value;
    let percent = document.getElementById('taskPercentComplete').value;
    let status = document.getElementById('taskStatus').value;
    let priority = document.getElementById('taskPriority').value;
    let id = taskModal.dataset.id;  
    let calendarId = taskModal.dataset.calendarId;
    let parent = document.getElementById('taskParent').value;
    let newCalendarId = document.getElementById('taskCalendar').value;
    let taskCategories = 
        (document.getElementById('taskCategories').value ?? '').split(',').map(elt => elt.trim());

    let item = (id !== "null") ?
        asTodo(await mc.items.get(calendarId, id, { returnFormat: "jcal" })) : 
        new JCAL.Todo();   

    if (title !== item.summary)
        item.summary = title;
    if (description !== item.description)
        item.description = description;
    if (dueDate && dueDate !== null && dueDate !== item.due) {
        item.due = (new Date(dueDate)).toISOString(); 
    }
    if (startDate && startDate !== null && startDate !== item.dtstart) {
        item.dtstart = (new Date(startDate)).toISOString();
    }

    // TODO handle categories the right way

    if (!parent) {
        if (item.relatedTo) {
            item.relatedTo = '';
        }
        if (item.xIcanbanParent) {
            item.xIcanbanParent = '';
        }
    }
    if (parent && parent !== item.relatedTo) {
        item.relatedTo = parent;
    }   
    if (parent && parent !== item.xIcanbanParent) {
        item.xIcanbanParent = parent;
    }   

    if (percent !== item.percentComplete) {
        item.percentComplete = parseInt(percent);
    }
    if (priority !== item.priority) {
        item.priority = parseInt(priority);
    }

    if (taskCategories !== item.categories) {
        item.categories = taskCategories;
    }

    item.status = status;
    
    if (id !== "null") {
        item.uid = id;
        await mc.items.update(calendarId, id, {format: 'jcal', item: item.data});

        if (calendarId !== newCalendarId) {
            await mc.items.move(calendarId, newCalendarId, id);
        }
    } else {
        item.type="task";
        await mc.items.create(newCalendarId, {type: 'task', format: 'jcal', item: item.data});
    }

    let modal = bootstrap.Modal.getInstance(document.getElementById("taskModal"));
    modal.hide();
}

saveTaskButton.addEventListener('click', saveTask);

if (taskModal) {
    taskModal.addEventListener('show.bs.modal', async (event) => {
        const source = event.relatedTarget;
        const id = source.dataset.id || null;
        const calendarId = source.dataset.calendarId || null;
        let item = {
            summary: "",
            description: "",
            dtstart: "",
            due: "",
            percentComplete: 0,
            status: "NEEDS-ACTION",
            priority: 0
        };

        if (id) {
            let cmp = await mc.items.get(calendarId, id, { returnFormat: "jcal" });
            item = asTodo(cmp);
            document.getElementById('taskModalColor').style.color = (await mc.calendars.get(calendarId)).color;
            document.getElementById('taskModalLabel').textContent = item.summary;
        } else {
            document.getElementById('taskModalColor').style.color = "black";
            document.getElementById('taskModalLabel').textContent = browser.i18n.getMessage("newTaskButton"); 
        }
        document.getElementById('taskTitle').value = item.summary;
        document.getElementById('taskDescription').value = item.description;
        document.getElementById('taskPriority').value = item.priority;
        document.getElementById('taskDueDate').value = item.due?item.due:'';
        document.getElementById('taskStartDate').value = item.dtstart?item.dtstart:'';
        document.getElementById('taskPercentComplete').value = item.percentComplete;
        document.getElementById('taskStatus').value = item.status;

        document.getElementById('taskCategories').value = 
            Array.isArray(item.categories)?
            item.categories.join(', '):
            (item.categories?item.categories:'');

        let catList = document.getElementById('taskCategoriesDropdown');
        catList.textContent = '';
        categories.forEach((key) => {
            let li = document.createElement('li');
            let a = document.createElement('a');
            a.textContent=key;
            a.target='#';
            a.addEventListener('click', (evt) => {
                let uiCategories = document.getElementById('taskCategories');
                if (uiCategories.value) {
                    if (uiCategories.value.indexOf(evt.target.textContent) === -1) {
                        uiCategories.value += `, ${evt.target.textContent}`;
                    }
                } else {
                    uiCategories.value = evt.target.textContent;
                }
            });
            li.appendChild(a);
            catList.appendChild(li);
            /** TODO add a callback to textContent */
        });


        taskModal.dataset.id = id;
        taskModal.dataset.calendarId = calendarId;

        document.querySelectorAll('#taskCalendar option').forEach(option => option.remove());
        document.querySelectorAll('#taskParent option').forEach(option => option.remove());

        let calendars = await mc.calendars.query(capability);
        calendars.sort( 
            (a, b) => a.name.localeCompare(b.name) 
        ).forEach(calendar => {
            let option = document.createElement('option');
            option.value = calendar.id;
            option.style.color = 'red';
            option.text = calendar.name;
            document.getElementById('taskCalendar').add(option);
        });
        document.getElementById('taskCalendar').value = calendarId;

        if (calendarId) {
            // put here all that is necessary for populating parent tasks
            let items = await mc.items.query({type: 'task', returnFormat: 'jcal', calendarId: calendarId});
            let defaultOption = document.createElement('option');
            defaultOption.text = browser.i18n.getMessage("noParentTask");
            defaultOption.selected = !item.relatedTo && !item.xIcanbanParent;
            defaultOption.value = '';
            document.getElementById('taskParent').add(defaultOption);

            items.forEach(item => {
                let todo = asTodo(item);
                if (id === item.id) return;
                let option = document.createElement('option');
                option.value = item.id;
                option.text = todo.summary;
                document.getElementById('taskParent').add(option);
            });
            if (item.relatedTo || item.xIcanbanParent) {    
                document.getElementById('taskParent').value = item.relatedTo ?? item.xIcanbanParent;
            }
        }

    });
}

/* handling modal for filtering */
const filterModal = document.getElementById('filterModal');
const allCalendars = document.getElementById('allCalendars');
const applyFilterButton = document.getElementById('applyFilter');
const allPriorities = document.getElementById('allPriorities');
const allCategories = document.getElementById('allCategories');
const categoriesPlaceholder = document.getElementById('categoriesPlaceholder');

let populateCategories = () => {
    categoriesPlaceholder.textContent = "";
    let div = document.createElement('div');
    div.classList.add('form-check', 'form-check-inline');
    let input = document.createElement('input');
    input.classList.add('form-check-input');
    input.type = 'checkbox';
    input.id = 'categorie-_blank_';
    input.value = null;
    let label = document.createElement('label');
    label.classList.add('form-check-label');
    label.htmlFor = 'categorie-_blank_';
    label.textContent = browser.i18n.getMessage('withoutAny');
    input.checked = filter.categories?.includes("");


    if (allCategories.checked) input.disabled = true;

    categoriesPlaceholder.appendChild(div);
    div.appendChild(input);
    div.appendChild(label);

    for(let c of categories) {
        div = document.createElement('div');
        div.classList.add('form-check', 'form-check-inline');

        input = document.createElement('input');
        input.classList.add('form-check-input');
        input.type = 'checkbox';
        input.id = `categorie-${c.toLowerCase()}`;
        input.value = c;
        if (filter.categories) {
            input.checked = filter.categories.includes(c);
        }

        label = document.createElement('label');
        label.classList.add('form-check-label');
        label.htmlFor = `categorie-${c.toLowerCase()}`;
        label.textContent = c;
    
        categoriesPlaceholder.appendChild(div);
        div.appendChild(input);
        div.appendChild(label);
    }
}


let populateCalendars = (calendars, filterList) => {
    filterList.textContent = "";
    calendars.sort( (a,b) => a.name.localeCompare(b.name) ).forEach(calendar => {
        let filterItem = document.createElement('div');
        filterItem.classList.add('form-check');
        filterItem.insertAdjacentHTML(
            'beforeend',
            DOMPurify.sanitize(`
                <input class="form-check-input" type="checkbox" value="${calendar.id}" id="filter-${calendar.id}" ${allCalendars.value?'disabled':''} ${filter.calendarId && filter.calendarId.includes(calendar.id)?'checked':''}>
                <label class="form-check-label" for="filter-${calendar.id}">
                    <i class="bi bi-circle-fill" style="color:${calendar.color}"></i>
                    ${calendar.name}
                </label>
            `)
        );
        filterList.appendChild(filterItem);
    });

    let checkboxesCal = document.querySelectorAll('#calendarList input');
    checkboxesCal.forEach(checkbox => {
        checkbox.disabled = allCalendars.checked;
    });
};

if (filterModal) {
    filterModal.addEventListener('show.bs.modal', async (event) => {
        let calendars = await mc.calendars.query(capability);
        let filterList = document.getElementById('calendarList');
        let allCalendars = document.getElementById('allCalendars');
        let calendarCapability = document.getElementById('calendarCapability');

        populateCalendars(calendars, filterList);   

        if (filter.calendarId && filter.calendarId.length > 0) {
            allCalendars.checked = false;
        }

        populateCategories();

        if (filter.categories !== undefined && filter.categories.length > 0) {
            allCategories.checked = false;
            for (let c of filter.categories) {
                let cat = document.querySelector(`#categoryPlaceholder input[value="${c}"]`);
                if (cat) cat.checked = true;
            }
        }

        if (filter.priority !== undefined) {
            allPriorities.checked = false;
            document,querySelector(`#priorityList input[value=${filter.priority}]`).checked = true;
        }

        if (capability.tasksSupported) {
            calendarCapability.checked = true;
        } else {
            calendarCapability.checked = false;
        }

        calendarCapability.addEventListener('change', async (event) => {
            capability = event.target.checked ? {tasksSupported: true} : {};
            let calendars = await mc.calendars.query(capability);
            populateCalendars(calendars, filterList);
        });

        let checkboxesPrio = document.querySelectorAll('#priorityList input');
        checkboxesPrio.forEach(checkbox => {
            checkbox.disabled = allPriorities.checked;
        });

        let checkboxesCat = document.querySelectorAll('#categoriesPlaceholder input');
        checkboxesCat.forEach(checkbox => {
            checkbox.disabled = allCategories.checked;
        });

    });
}


if (applyFilterButton) {
    applyFilterButton.addEventListener('click', async (event) => {
        filter = {};
        let calendarList = document.getElementById('calendarList');
        let calendarIds = [];
        if (!allCalendars.checked) {
            calendarIds = Array.from(calendarList.querySelectorAll('input:checked')).map(input => input.value);
        }
        let priorityList = document.getElementById('priorityList');
        let priorities = [];
        if (!allPriorities.checked) {
            priorities = Array.from(priorityList.querySelectorAll('input:checked')).map(input => parseInt(input.value));
        }
        let categoryList = document.getElementById('categoryList');
        if (!allCategories.checked) {
            filter.categories = [];
            Array.from(categoriesPlaceholder.querySelectorAll('input:checked')).forEach(input => filter.categories.push(input.value));
        }

        if (calendarIds.length > 0) {
            filter.calendarId = calendarIds;
        }
        if (priorities.length > 0) {
            filter.priority = priorities[0];
        }

        let calendarCapability = document.getElementById('calendarCapability');
        capability = calendarCapability.checked ? {tasksSupported: true} : {};

        setStorage("icanban-capability", capability);
        setStorage("icanban-filter", filter);
        refreshBoard();
    });
}

if (allCalendars) {
    allCalendars.addEventListener('change', async (event) => {
        let checkboxes = document.querySelectorAll('#calendarList input');
        checkboxes.forEach(checkbox => {
            checkbox.disabled = event.target.checked;
        });
    });
}

if (allPriorities) {    
    allPriorities.addEventListener('change', async (event) => {
        let checkboxes = document.querySelectorAll('#priorityList input');
        checkboxes.forEach(checkbox => {
            checkbox.disabled = event.target.checked;
        });
    });
}

if (allCategories) {
    allCategories.addEventListener('change', async(event) => {
        let checkboxes = document.querySelectorAll("#categoriesPlaceholder input");
        checkboxes.forEach(checkbox => {
            checkbox.disabled = event.target.checked;
        });        
    })
}

/* handling modal for sorting */

const sortStrategies = {
    // priority values are inverted with 1 being the highest priority
    "priorityASort": (ai, bi) => {
        const a = asTodo(ai);
        const b = asTodo(bi); 
        a.priority = a.priority || 5; // none given is normal priority
        b.priority = b.priority || 5;
        return b.priority - a.priority;
    },
    "priorityDSort": (ai, bi) => {
        const a = asTodo(ai);
        const b = asTodo(bi);
        a.priority = a.priority || 5;
        b.priority = b.priority || 5;
        return a.priority - b.priority;
    },
    "percentCompleteASort": (ai, bi) => {
        const a = asTodo(ai);
        const b = asTodo(bi);
        return a.percentComplete - b.percentComplete;
    },
    "percentCompleteDSort": (ai, bi) => {
        const a = asTodo(ai);
        const b = asTodo(bi);
        return b.percentComplete - a.percentComplete;
    },
    "dueDateASort" : (ai, bi) => {
        const a = asTodo(ai);
        const b = asTodo(bi);
        return (new String(a.due || '')).localeCompare(b.due || '');
    },
    "dueDateDSort" : (ai, bi) => {
        const a = asTodo(ai);
        const b = asTodo(bi);
        return (new String(b.due || '')).localeCompare(a.due || '');
    }
}

const applySortButton = document.getElementById('applySort');

if (applySortButton) {
    applySortButton.addEventListener('click', async (event) => {
        let sortValue = Array.from(document.querySelectorAll('#sortList input')).find(input => input.checked).value;
        sort = (sortValue === "none") ? null : sortStrategies[sortValue];
        setStorage("icanban-sort", sortValue);
        refreshBoard();
    });
}

const sortModal = document.getElementById('sortModal');
if (sortModal) {
    sortModal.addEventListener('show.bs.modal', async (event) => {
        document.querySelectorAll('#sortList input').forEach(input => { input.checked = false; });
        if (sort) {
            let sortValue = Object.keys(sortStrategies).find(key => sortStrategies[key] === sort);
            document.getElementById(sortValue).checked = true;
        } else {
            document.getElementById('nonePriority').checked = true;
        }
    });
}

/* refresh button */
const refreshButton = document.getElementById('refreshButton');
if (refreshButton) {
    refreshButton.addEventListener('click', async (event) => {
        await refreshBoard();
    });
}

/* Board setup */
let clearBoard = () => {
    /** TODO can even be more blunt */
    let kanbanLists = document.getElementsByClassName("kanban-list");
    for (let i=0; i <kanbanLists.length; i++) {
        kanbanLists[i].textContent = "";
    }
};

let setupColumns = async () => {
    /** TODO insert here dynamic generation of columns */
    // should return at least column names with resetted counters

    return { "NEEDS-ACTION": 0, "IN-PROCESS": 0, "COMPLETED": 0 };
};

let populateBoard = async () => {
    let items = (await mc.items.query(Object.assign({ type: "task", returnFormat: "jcal"}, filter))).filter(item => {
        if (filter.priority !== undefined && asTodo(item).priority !== filter.priority) {
            return false;
        }

        if (filter.categories !== undefined) {
            if (asTodo(item).categories === null && filter.categories.includes(""))
                return true; 
            
            let catTasks = new Set(asTodo(item).categories);
            if (catTasks.intersection(new Set(filter.categories)).size === 0) {
                return false;
            }
        }

        if (!globalThis.browser && filter.calendarId !== undefined && !filter.calendarId.includes(item.calendarId)) {
            return false;
        }
        return true;
    });
    if (sort) {
        items.sort(sort);
    }
    categories.clear();
    
    let counts = await setupColumns();

    let parentMap = new Map();    
    for(const element of items) {
        let todo = asTodo(element);

        // we need to filter out if element is already on the board
        if (document.getElementById(element.id) === null) {
            const template = document.getElementById('cardTemplate');
            const card = template.content.cloneNode(true).children[0];
            if (todo.categories) {
                if (Array.isArray(todo.categories)) {
                    todo.categories.forEach(cat => categories.add(cat));
                } else {
                    categories.add(todo.categories);
                }
            }
            card.id = element.id;
            card.addEventListener("dragstart", (event) => {
                event.dataTransfer.setData("text/plain", JSON.stringify({id : element.id, calendarId: element.calendarId}));
                event.dataTransfer.dropEffect = "move";
            });
            let calendar = await mc.calendars.get(element.calendarId);

            card.querySelector('.card').style.borderColor = calendar.color;
            card.querySelector('.card-title').appendChild( 
                document.createTextNode(' ' + todo.summary + ' ')
            );

            if (todo.description) {
                card.querySelector('.card-text').insertAdjacentHTML(
                    'beforeend', DOMPurify.sanitize(marked.parse(todo.description))
                );
                card.querySelector('.card-text').id = `collapse-${element.id}`;
                card.querySelector('.card-title').dataset.bsTarget = `#collapse-${element.id}`;
                card.querySelector('.card-icon').classList.add('bi-caret-down-square-fill');
                card.querySelector('.card-icon').style.color = `color-mix(in srgb, black 10%, ${calendar.color} 90%)`;
            } else {
                card.querySelector('.card-icon').classList.add('bi-circle-fill');
                card.querySelector('.card-icon').style.color = calendar.color;
            }



            let cardFooter = card.querySelector('.card-footer');
            if (todo.due) {
                let cardDueDate = document.createElement('span');
                cardDueDate.classList.add('bi-calendar-week-fill');
                cardFooter.appendChild(cardDueDate);
                cardFooter.appendChild(
                    document.createTextNode(
                        ` ${(new Date(todo.due)).toLocaleString()} `
                    )
                );
                /** TODO reevaluate how a task is indicated as completed (is 100% enough) */
                if (todo.status !== 'COMPLETED' && Date.now() > Date.parse(todo.due)) {
                    cardFooter.classList.add('text-danger');
                    cardFooter.style.fontWeight = 'bold';
                }
            } else {
                cardFooter.classList.add('text-muted');
            }
            /** TODO may not be need anymore -> filter out 0% and 100% instead of status*/
            if (todo.percentComplete && todo.status === "IN-PROCESS") {
                let cardPercent = document.createElement('span');
                cardPercent.classList.add('bi-graph-up');
                cardFooter.appendChild(cardPercent);
                cardFooter.appendChild(document.createTextNode(' '+todo.percentComplete + '% '));

                card.querySelector('.progress').hidden=false;
                let cardProgress = card.querySelector('.progress-bar');
                cardProgress.style.width=''+todo.percentComplete+'%';
                cardProgress.style.background=calendar.color;
            }
            if (todo.categories) {
                let cardCategories = document.createElement('span');
                cardCategories.classList.add('bi-tags-fill');
                cardFooter.appendChild(cardCategories);
                cardFooter.appendChild(
                    document.createTextNode(
                        ' '+
                        (Array.isArray(todo.categories)?
                            todo.categories.join(', '):
                            todo.categories)
                    )
                );
            }

            if (todo.priority) {
                let cardPriority = document.createElement('span');
                switch(todo.priority) {
                    case 1:
                        cardPriority.classList.add('bi-caret-up-fill');
                        cardPriority.style.color = 'red';
                        break;
                    case 9:
                        cardPriority.classList.add('bi-caret-down-fill');
                        cardPriority.style.color = 'green';
                        break;
                    default:
                        cardPriority.classList.add('bi-caret-right-fill');
                        cardPriority.style.color = 'black';
                }
                cardPriority.style.float = 'right';
                cardFooter.appendChild(cardPriority);
            }

            let cardActionEdit = card.querySelector('.bi-pencil-fill');
            cardActionEdit.dataset.id = element.id;
            cardActionEdit.dataset.calendarId = element.calendarId;

            let cardActionDelete = card.querySelector('.bi-trash3-fill');
            cardActionDelete.dataset.id = element.id;
            cardActionDelete.dataset.calendarId = element.calendarId;
            cardActionDelete.addEventListener('click', async (event) => {
                confirm(browser.i18n.getMessage("confirmDeletionMessage")) &&
                    await mc.items.remove(event.target.dataset.calendarId, event.target.dataset.id);
            });

            /** TODO Needs-action is the default column, we may need one in parameters */
            let list = document.getElementById(todo.status ?? 'NEEDS-ACTION');
            /** TODO update the way count is performed */
            counts[todo.status] += 1;
            
            // elements may not be in the DOM yet
            if (todo.relatedTo || todo.xIcanbanParent) {
                console.log("added to parent map", todo);
                parentMap.set(element.id, {parent: todo.relatedTo ?? todo.xIcanbanParent, card: card, todo: todo});
            } else {
                list.appendChild(card);
            }

            /** TODO  update the way actions are counted in each column */
            document.getElementById("needs-action-count").textContent = counts["NEEDS-ACTION"];
            document.getElementById("in-process-count").textContent = counts["IN-PROCESS"];
            document.getElementById("completed-count").textContent = counts["COMPLETED"];
        }
    }

    // not good yet
    let oldSize = parentMap.size + 1;
    while (parentMap.size > 0 && oldSize > parentMap.size) {
        oldSize = parentMap.size;
        parentMap.forEach((value,key) => {      
            console.log("trying to add", value);      
            let parent = document.getElementById(value.parent);
            if (parent) {
                parent.querySelector('.card-children').appendChild(value.card);
                parent.querySelector('.bi-plus-square-fill').hidden = false;
                parent.querySelector('.bi-plus-square-fill').dataset.bsTarget = `#${value.parent} .card-children`;
                parentMap.delete(key);
            } else {
                console.log("failed to add", value);    
                // we have to check if the requested element is in the item list
                let item = items.find(item => item.id === value.parent);
                if (!item) {
                    document.getElementById(value.todo.status).appendChild(value.card);
                    parentMap.delete(key);
                }
            }
        });
    }

    /** TODO Same code twice, check if this one is still needed anymore */
    document.getElementById("needs-action-count").textContent = counts["NEEDS-ACTION"];
    document.getElementById("in-process-count").textContent = counts["IN-PROCESS"];
    document.getElementById("completed-count").textContent = counts["COMPLETED"];
    toggleAllCollapse(compact.mode);
};

let inRefresh = false;

let refreshBoard = async () => {
    if (!inRefresh) {
        inRefresh = true;
        clearBoard();
        await populateBoard();
        inRefresh = false;
    }
};


let filterPrefs = {};
let sortPrefs = {};

filterPrefs = await getStorage("icanban-filter") ?? {};
sortPrefs = await getStorage("icanban-sort") ?? {};
capability = await getStorage("icanban-capability") ?? {};
compact = await getStorage("icanban-compact-mode") ?? {mode: false};

if (filterPrefs) {
    filter = filterPrefs
} 
if (sortPrefs) {
    sort = (sortPrefs === "none") ? null : sortStrategies[sortPrefs];   
}

if (compactModeSwitch) {
    compactModeSwitch.checked = compact.mode;
}

await populateBoard();

/*    toggleAllCollapse(compact.mode);
}*/

if (globalThis.messenger !== undefined) {
    mc.items.onCreated.addListener(refreshBoard);
    mc.items.onUpdated.addListener(refreshBoard);
    mc.items.onRemoved.addListener(refreshBoard);

    mc.calendars.onCreated.addListener(refreshBoard);
    mc.calendars.onUpdated.addListener(refreshBoard);
    mc.calendars.onRemoved.addListener(refreshBoard);
} else {
    mc.items.addEventListener("created",refreshBoard);
    mc.items.addEventListener("updated",refreshBoard);
    mc.items.addEventListener("removed",refreshBoard);

    mc.calendars.addEventListener("created",refreshBoard);
    mc.calendars.addEventListener("updated",refreshBoard);
    mc.calendars.addEventListener("removed",refreshBoard);
}