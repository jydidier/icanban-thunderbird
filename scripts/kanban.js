let mc = messenger.calendar;
let theme = await browser.theme.getCurrent();

console.log("Theme", theme);
document.body.style.setProperty('--background-color', "lightgray");


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


let clearBoard = () => {    
    document.getElementById("NEEDS-ACTION").innerHTML = "";
    document.getElementById("IN-PROCESS").innerHTML = "";
    document.getElementById("COMPLETED").innerHTML = "";
};

let populateBoard = async () => {
    let items = await mc.items.query({ type: "task"});

    items.forEach(async element => {
        console.log('Item', element.title, element.status);

        let list = document.getElementById(element.status);

        let item = document.createElement('li');

        let calendar = await mc.calendars.get(element.calendarId);
        item.style.backgroundColor = calendar.color;    
        item.classList.add('kanban-item');

        let title = document.createElement('b');
        title.textContent = element.title;
        item.appendChild(title);
        item.appendChild(document.createElement('br'));
        item.appendChild(document.createTextNode(element.description));
        item.id = element.id;
        item.draggable = true;
        item.addEventListener("dragstart", (event) => {
            event.dataTransfer.setData("text/plain", JSON.stringify({id : event.target.id, calendarId: element.calendarId}));
            event.dataTransfer.dropEffect = "move";
        });

        list.appendChild(item);

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