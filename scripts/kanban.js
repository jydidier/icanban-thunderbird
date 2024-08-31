const mc = messenger.calendar;

/* DRAG'N DROP SETUP */
let dragover = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
}

let drop = async (event) => {
    event.preventDefault();
    console.log("Tried to drop", event.target, event.target.elementType);
    let target = event.target;
    if (event.target.nodeName === "DIV") {
        target = event.target.querySelector('.kanban-list');
        console.log(target);
    } 

    if (target.classList.contains('kanban-list')) {
        let data = JSON.parse(event.dataTransfer.getData("text/plain"));
        console.log("Dropped", data, "on", target, "event", event);
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

/* Modal setup */
const taskModal = document.getElementById('taskModal');
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
        //document.getElementById('taskCalendarId').value = calendarId;

    });
}



/* Board setup */
let clearBoard = () => {    
    document.getElementById("NEEDS-ACTION").innerHTML = "";
    document.getElementById("IN-PROCESS").innerHTML = "";
    document.getElementById("COMPLETED").innerHTML = "";
};


let parseICalDate = (date) => {
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
        // TODO: use html template fragment
        let card = document.createElement('div');
        card.classList.add('card');
        card.classList.add('kanban-item');
        card.id = element.id;
        card.draggable = true;
            card.addEventListener("dragstart", (event) => {
                event.dataTransfer.setData("text/plain", JSON.stringify({id : event.target.id, calendarId: element.calendarId}));
                event.dataTransfer.dropEffect = "move";
            }
        );

        let calendar = await mc.calendars.get(element.calendarId);
        card.style.borderColor = calendar.color;

        let cardBody = document.createElement('div');
        cardBody.classList.add('card-body');

        let cardTitle = document.createElement('h7');
        cardTitle.classList.add('card-title');
        cardTitle.classList.add('title-ellipsis');

        let icon = document.createElement('span');
        icon.classList.add('bi-circle-fill');
        icon.style.color = calendar.color;
        cardTitle.appendChild(icon);
        cardTitle.appendChild(document.createTextNode(' ' + element.title));


        cardBody.appendChild(cardTitle);

        let cardContent = document.createElement('p');
        cardContent.textContent = element.description;
        cardContent.classList.add('card-text');
        cardContent.classList.add('text-ellipsis');
        cardContent.classList.add('text-muted');
        cardBody.appendChild(cardContent);

        let cardFooter = document.createElement('div');
        cardFooter.classList.add('card-footer');

        if (element.dueDate) {
            let cardDueDate = document.createElement('span');
            cardDueDate.classList.add('bi-calendar-week-fill');
            cardFooter.appendChild(cardDueDate);
            cardFooter.appendChild(document.createTextNode(' '+parseICalDate(element.dueDate).toLocaleString()+' '));

            //if (element.status !== "COMPLETED") {
                if (Date.now() > parseICalDate(element.dueDate)) {
                    cardFooter.classList.add('text-danger');
                    cardFooter.style.fontWeight = 'bold';
                }
            //}
        } else {
            cardFooter.classList.add('text-muted');
        }
        if (element.percent && element.status === "IN-PROCESS") {
            let cardPercent = document.createElement('span');
            cardPercent.classList.add('bi-graph-up');
            cardFooter.appendChild(cardPercent);
            cardFooter.appendChild(document.createTextNode(' '+element.percent + '%'));
        }

        let cardActionEdit = document.createElement('a');
        cardActionEdit.classList.add('bi-pencil-fill');
        cardActionEdit.style.float = 'right';
        cardActionEdit.dataset.id = element.id;
        cardActionEdit.dataset.calendarId = element.calendarId;
        cardActionEdit.dataset.bsToggle = 'modal';
        cardActionEdit.dataset.bsTarget = '#taskModal';
        

        let cardActionDelete = document.createElement('a');
        cardActionDelete.classList.add('bi-trash3-fill');
        cardActionDelete.style.float = 'right';
        cardActionDelete.dataset.id = element.id;
        cardActionDelete.dataset.calendarId = element.calendarId;
        cardActionDelete.addEventListener('click', async (event) => {
            confirm("Are you sure you want to delete this item?") &&
                await mc.items.remove(event.target.dataset.calendarId, event.target.dataset.id);
        });

        cardFooter.appendChild(cardActionDelete);
        cardFooter.appendChild(cardActionEdit);

        card.appendChild(cardBody);
        card.appendChild(cardFooter);

    

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