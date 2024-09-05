/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */


const mc = messenger.calendar;

let filter = {};
let sort = null;
const categories = new Set();

/* DRAG'N DROP SETUP */
let dragover = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
}

let drop = async (event) => {
    event.preventDefault();
    let target = event.target;
    if (event.target.nodeName === "DIV") {
        target = event.target.querySelector('.kanban-list');
    } 

    if (target.classList.contains('kanban-list')) {
        let data = JSON.parse(event.dataTransfer.getData("text/plain"));
        /* necessary as an instant feedback for the user */
        target.appendChild(document.getElementById(data.id));

        await mc.items.update(data.calendarId, data.id, { status: target.id });
    }
};

document.getElementById("NEEDS-ACTION").parentElement.addEventListener("drop", drop);
document.getElementById("COMPLETED").parentElement.addEventListener("drop", drop);
document.getElementById("IN-PROCESS").parentElement.addEventListener("drop", drop);
document.getElementById("NEEDS-ACTION").parentElement.addEventListener("dragover", dragover);
document.getElementById("COMPLETED").parentElement.addEventListener("dragover", dragover);
document.getElementById("IN-PROCESS").parentElement.addEventListener("dragover", dragover);

/* Modal setup for task edition */
const taskModal = document.getElementById('taskModal');
const saveTaskButton = document.getElementById('saveTask');

const saveTask = async () => {
    let title = document.getElementById('taskTitle').value;
    let description = document.getElementById('taskDescription').value;
    let dueDate = document.getElementById('taskDueDate').value;
    let percent = document.getElementById('taskPercentComplete').value;
    let status = document.getElementById('taskStatus').value;
    let priority = document.getElementById('taskPriority').value;
    let id = taskModal.dataset.id;  
    let calendarId = taskModal.dataset.calendarId;
    let newCalendarId = document.getElementById('taskCalendar').value;

    //let item = await mc.items.get(calendarId, id);
    let item = {};
    if (title)
        item.title = title;
    if (description)
        item.description = description;
    if (dueDate) {
        item.dueDate = convertDateTimeField(dueDate);
    }
    if (percent) {
        item.percent = parseInt(percent);
    }
    if (priority) {
        item.priority = parseInt(priority);
    }
    item.status = status;


    if (id !== "null") {
        await mc.items.update(calendarId, id, item);

        if (calendarId !== newCalendarId) {
            await mc.items.move(calendarId, newCalendarId, id);
        }
    } else {
        item.type="task";
        await mc.items.create(newCalendarId, item);
    }
}

saveTaskButton.addEventListener('click', saveTask);


if (taskModal) {
    taskModal.addEventListener('show.bs.modal', async (event) => {
        const source = event.relatedTarget;
        const id = source.dataset.id || null;
        const calendarId = source.dataset.calendarId || null;
        let item = {
            title: "",
            description: "",
            dueDate: "",
            percent: 0,
            status: "NEEDS-ACTION",
            priority: 0
        };

        if (id) {
            item = await mc.items.get(calendarId, id);            
            document.getElementById('taskModalColor').style.color = (await mc.calendars.get(calendarId)).color;
            document.getElementById('taskModalLabel').textContent = item.title;
        } else {
            document.getElementById('taskModalColor').style.color = "black";
            document.getElementById('taskModalLabel').textContent = "New task...";
        }
        document.getElementById('taskTitle').value = item.title;
        document.getElementById('taskDescription').value = item.description;
        document.getElementById('taskPriority').value = item.priority;
        document.getElementById('taskDueDate').value = item.dueDate?
            convertDatetoISOLocaleString(parseICalDate(item.dueDate)).slice(0,16):'';        
        document.getElementById('taskPercentComplete').value = item.percent;
        document.getElementById('taskStatus').value = item.status;
        taskModal.dataset.id = id;
        taskModal.dataset.calendarId = calendarId;

        document.querySelectorAll('#taskCalendar option').forEach(option => option.remove());

        let calendars = await mc.calendars.query({});
        calendars.sort( 
            (a, b) => a.name.localeCompare(b.name) 
        ).forEach(calendar => {
            let option = document.createElement('option');
            option.value = calendar.id;
            option.text = calendar.name;
            document.getElementById('taskCalendar').add(option);
        });
        document.getElementById('taskCalendar').value = calendarId;

    });
}

/* handling modal for filtering */

const filterModal = document.getElementById('filterModal');
const allCalendars = document.getElementById('allCalendars');
const applyFilterButton = document.getElementById('applyFilter');
const allPriorities = document.getElementById('allPriorities');


if (filterModal) {
    filterModal.addEventListener('show.bs.modal', async (event) => {
        let calendars = await mc.calendars.query({});
        let filterList = document.getElementById('calendarList');
        let allCalendars = document.getElementById('allCalendars');
        filterList.innerHTML = "";
        calendars.sort( (a,b) => a.name.localeCompare(b.name) ).forEach(calendar => {
            let filterItem = document.createElement('div');
            filterItem.classList.add('form-check');
            filterItem.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${calendar.id}" id="filter-${calendar.id}" ${allCalendars.value?'disabled':''} ${filter.calendarId && filter.calendarId.includes(calendar.id)?'checked':''}>
                <label class="form-check-label" for="filter-${calendar.id}">
                    <i class="bi bi-circle-fill" style="color:${calendar.color}"></i>
                    ${calendar.name}
                </label>
            `;
            filterList.appendChild(filterItem);
        });

        if (filter.calendarId && filter.calendarId.length > 0) {
            allCalendars.checked = false;
        }

        if (filter.priority !== undefined) {
            allPriorities.checked = false;
            document,querySelector(`#priorityList input[value=${filter.priority}]`).checked = true;
        }

        let checkboxesCal = document.querySelectorAll('#calendarList input');
        checkboxesCal.forEach(checkbox => {
            checkbox.disabled = allCalendars.checked;
        });

        let checkboxesPrio = document.querySelectorAll('#priorityList input');
        checkboxesPrio.forEach(checkbox => {
            checkbox.disabled = allPriorities.checked;
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

        if (calendarIds.length > 0) {
            filter.calendarId = calendarIds;
        }
        if (priorities.length > 0) {
            filter.priority = priorities[0];
        }

        await browser.storage.local.set({"icanban-filter": filter});
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

/* handling modal for sorting */

const sortStrategies = {
    // priority values are inverted with 1 being the highest priority
    "priorityASort": (a, b) => { 
        a = a || 5; // none given is normal priority
        b = b || 5;
        return b.priority - a.priority;
    },
    "priorityDSort": (a, b) => {
        a = a || 5;
        b = b || 5;
        return a.priority - b.priority;
    },
    "percentCompleteASort": (a, b) => a.percent - b.percent,
    "percentCompleteDSort": (a, b) => b.percent - a.percent,
    "dueDateASort" : (a, b) => new String(a.dueDate || '').localeCompare(b.dueDate || ''),
    "dueDateDSort" : (a, b) => new String(b.dueDate || '').localeCompare(a.dueDate || ''),
}

const applySortButton = document.getElementById('applySort');

if (applySortButton) {
    applySortButton.addEventListener('click', async (event) => {
        let sortValue = Array.from(document.querySelectorAll('#sortList input')).find(input => input.checked).value;
        sort = (sortValue === "none") ? null : sortStrategies[sortValue];
        await browser.storage.local.set({ "icanban-sort": sortValue} );   
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
        refreshBoard();
    });
}

/* Board setup */
let clearBoard = () => {    
    document.getElementById("NEEDS-ACTION").innerHTML = "";
    document.getElementById("IN-PROCESS").innerHTML = "";
    document.getElementById("COMPLETED").innerHTML = "";
};

const convertDatetoISOLocaleString = (date) => {
    return String(date.getFullYear()).padStart(4,'0') + '-' + 
        String(date.getMonth()).padStart(2,'0') + '-' + 
        String(date.getDate()).padStart(2,'0') + 'T' + 
        String(date.getHours()).padStart(2,'0') + ':' + 
        String(date.getMinutes()).padStart(2,'0');    
}

const convertDateTimeField = (date) => {
    return date.substr(0, 4) + 
        date.substr(5, 2) +
        date.substr(8, 2) +
        'T' +
        date.substr(11, 2) +
        date.substr(14, 2) +
        '00';
}

const parseICalDate = (date) => {
    const year = date.substr(0, 4);
    const month = parseInt(date.substr(4, 2), 10) - 1;
    const day = date.substr(6, 2);
    const hour = date.substr(9, 2);
    const minute = date.substr(11, 2);
    const second = date.substr(13, 2);
    return new Date(year, month, day, hour, minute, second);
}

let populateBoard = async () => {
    let items = (await mc.items.query(Object.assign({ type: "task"}, filter))).filter(item => {
        if (filter.priority !== undefined && item.priority !== filter.priority) {
            return false;
        }   
        return true;
    });
    if (sort) {
        items.sort(sort);
    }
    let counts = { "NEEDS-ACTION": 0, "IN-PROCESS": 0, "COMPLETED": 0 };
    items.forEach(async element => {
        // we need to filter out if element is already on the board
        if (document.getElementById(element.id) === null) {
            const template = document.getElementById('cardTemplate');
            const card = template.content.cloneNode(true).children[0];
            //element.categories.forEach(cat => categories.add(cat));
            card.id = element.id;
            card.addEventListener("dragstart", (event) => {
                event.dataTransfer.setData("text/plain", JSON.stringify({id : element.id, calendarId: element.calendarId}));
                event.dataTransfer.dropEffect = "move";
            });
            let calendar = await mc.calendars.get(element.calendarId);
            card.style.borderColor = calendar.color;
            card.querySelector('.bi-circle-fill').style.color = calendar.color;
            card.querySelector('.card-title').appendChild( 
                document.createTextNode(' ' + element.title)
            );
            card.querySelector('.card-text').textContent = element.description;

            let cardFooter = card.querySelector('.card-footer');
            if (element.dueDate) {
                let cardDueDate = document.createElement('span');
                cardDueDate.classList.add('bi-calendar-week-fill');
                cardFooter.appendChild(cardDueDate);
                cardFooter.appendChild(document.createTextNode(' '+parseICalDate(element.dueDate).toLocaleString()+' '));
                if (element.status !== 'COMPLETED' && Date.now() > parseICalDate(element.dueDate)) {
                    cardFooter.classList.add('text-danger');
                    cardFooter.style.fontWeight = 'bold';
                }
            } else {
                cardFooter.classList.add('text-muted');
            }
            if (element.percent && element.status === "IN-PROCESS") {
                let cardPercent = document.createElement('span');
                cardPercent.classList.add('bi-graph-up');
                cardFooter.appendChild(cardPercent);
                cardFooter.appendChild(document.createTextNode(' '+element.percent + '% '));

                card.querySelector('.progress').hidden=false;
                let cardProgress = card.querySelector('.progress-bar');
                //cardProgress.display="block";
                cardProgress.style.width=''+element.percent+'%';
                cardProgress.style.background=calendar.color;
            }
            if (element.categories && element.categories.length > 0) {
                let cardCategories = document.createElement('span');
                cardCategories.classList.add('bi-tags-fill');
                cardFooter.appendChild(cardCategories);
                cardFooter.appendChild(document.createTextNode(' '+element.categories.join(', ')));
            }

            if (element.priority) {
                let cardPriority = document.createElement('span');
                switch(element.priority) {
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
                confirm("Are you sure you want to delete this item?") &&
                    await mc.items.remove(event.target.dataset.calendarId, event.target.dataset.id);
            });

            let list = document.getElementById(element.status);
            counts[element.status] += 1;
            
            list.appendChild(card);
            document.getElementById("needs-action-count").textContent = counts["NEEDS-ACTION"];
            document.getElementById("in-process-count").textContent = counts["IN-PROCESS"];
            document.getElementById("completed-count").textContent = counts["COMPLETED"];
        }
    });

    document.getElementById("needs-action-count").textContent = counts["NEEDS-ACTION"];
    document.getElementById("in-process-count").textContent = counts["IN-PROCESS"];
    document.getElementById("completed-count").textContent = counts["COMPLETED"];
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

let filterPrefs = await browser.storage.local.get("icanban-filter");
let sortPrefs = await browser.storage.local.get("icanban-sort");

if (filterPrefs["icanban-filter"] !== undefined) {
    filter = filterPrefs["icanban-filter"];
} 
if (sortPrefs["icanban-sort"] !== undefined) {
    sort = (sortPrefs === "none") ? null : sortStrategies[sortPrefs["icanban-sort"]];   
}


await populateBoard();

mc.items.onCreated.addListener(refreshBoard);
mc.items.onUpdated.addListener(refreshBoard);
mc.items.onRemoved.addListener(refreshBoard);

mc.calendars.onCreated.addListener(refreshBoard);
mc.calendars.onUpdated.addListener(refreshBoard);
mc.calendars.onRemoved.addListener(refreshBoard);