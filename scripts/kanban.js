const mc = messenger.calendar;

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
        /* is the next line necessary? */
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
    let id = taskModal.dataset.id;  
    let calendarId = taskModal.dataset.calendarId;

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
    item.status = status;
    await mc.items.update(calendarId, id, item);
}

saveTaskButton.addEventListener('click', saveTask);


if (taskModal) {
    taskModal.addEventListener('show.bs.modal', async (event) => {
        const source = event.relatedTarget;
        const id = source.dataset.id;
        const calendarId = source.dataset.calendarId;

        let item = await mc.items.get(calendarId, id);
        document.getElementById('taskModalColor').style.color = (await mc.calendars.get(calendarId)).color;
        document.getElementById('taskModalLabel').textContent = item.title;
        document.getElementById('taskTitle').value = item.title;
        document.getElementById('taskDescription').value = item.description;
        if (item.dueDate) {
            document.getElementById('taskDueDate').value = parseICalDate(item.dueDate).toISOString().slice(0,16);
        }
        document.getElementById('taskPercentComplete').value = item.percent;
        document.getElementById('taskStatus').value = item.status;
        taskModal.dataset.id = id;
        taskModal.dataset.calendarId = calendarId;
    });
}



/* Board setup */
let clearBoard = () => {    
    document.getElementById("NEEDS-ACTION").innerHTML = "";
    document.getElementById("IN-PROCESS").innerHTML = "";
    document.getElementById("COMPLETED").innerHTML = "";
};

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
    let items = await mc.items.query({ type: "task"});
    let counts = { "NEEDS-ACTION": 0, "IN-PROCESS": 0, "COMPLETED": 0 };
    items.forEach(async element => {
        const template = document.getElementById('cardTemplate');
        const card = template.content.cloneNode(true).children[0];
        card.addEventListener("dragstart", (event) => {
            event.dataTransfer.setData("text/plain", JSON.stringify({id : event.target.id, calendarId: element.calendarId}));
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
            if (Date.now() > parseICalDate(element.dueDate)) {
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
            cardFooter.appendChild(document.createTextNode(' '+element.percent + '%'));
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

    });
};

let refreshBoard = async () => {
    clearBoard();
    await populateBoard();
};

await populateBoard();

mc.items.onCreated.addListener(refreshBoard);
mc.items.onUpdated.addListener(refreshBoard);
mc.items.onRemoved.addListener(refreshBoard);