
// hypothesis: calendar is not needed for the properties
// however, the remaining ones are needed.
// basically, we need to be able to make things with a vtodo

const Types = [
    'binary', 'boolean', 'cal-address', 'date', 'date-time', 'duration', 
    'float', 'integer', 'period', 'recur', 'text', 'time', 'uri', 'utc-offset',
    'x-type'
];

const CalendarProperties = {
    'calscale' : { type: 'text', unique: true},
    'method' : { type: 'text', unique: true},
    'prodid' : { type: 'text', required: true, unique: true},
    'version' : { type: 'text', required: true, unique: true}
};

const TodoProperties = {
    'dtstamp' : { type: 'date-time', required: true, unique: true},
    'uid' : {type: 'text', required: true, unique: true},
    'class' : { type : 'text', unique : true},
    'completed' : { type: 'date-time', unique: true},
    'created' : { type: 'date-time', unique: true},
    'description' : { type: 'text', unique: true},
    'dtstart' : { type: 'date-time', unique: true},
    //'geo': { type: /* array of 2 floats */, unique: true},
    'last-modified' : { type: 'date-time', unique: true},
    'location' : { type: 'text', unique : true},
    //'organizer' : { type: 'cal-address', unique: true},
    'percent-complete' : { type: 'integer', unique: true},
    'priority' : { type: 'integer', unique: true},
    //'recurid'
    //'seq'
    'status' : { type: 'text', unique: true},
    'summary' : { type: 'text', unique: true},
    //'url':
    //'rrule'
    'due' : { type: 'date-time', unique: true, conflict: 'duration'},
    'duration': { type: 'duration', unique: true, conflict: 'due'},
    // starting from this point, all properties may not be unique
    //'attach' : { type: },
    //'attendee'
    'categories' : {type: 'string'},
    //'comment'
    //'contact'
    //'exdate'
    //'rstatus'
    'related-to' : { type: 'text'},
    'x-icanban-parent' : { type: 'text', unique: true}
    //'resources'
    //'rdate'
    //'x-prop'
    //'iana-prop'
};


const toCamelCase = (inp) => {
    return inp.replace(/-([a-z])/g, function(k){
        return k[1].toUpperCase();
    });
};


class Component {
    #data = null;

    constructor(data) {
        if (Array.isArray(data)) {
            this.#data = data;            
        } else {
            this.#data = [ data, [], []];
        }
    }

    get data() {
        return this.#data;
    }

    first(type) {
        if (this.#data[2].length > 0) {
            if (type) {
                let result = null;
                this.#data[2].forEach(element => {
                    if (element[0] === type) {
                        switch (type) {
                            case 'vtodo':
                                result = new Todo(element);
                                break;
                            default:
                                result = new Component(element);
                        }
                    }
                });
                return result;
            } else {
                return new Component(this.#data[2][0]);
            }
        }
        return null;
    }

    merge(component) {
        let entries = Object.entries(component);
        entries.forEach(entry => {
            if (entry[1] !== null && entry[0] !== 'data') {
                this[entry[0]] = entry[1];
            }
        });
    }

    setPropertyParameter(property, parameter, value) {
        this.#data[1].forEach(elt => {
            if (elt[0] === property) {
                elt[1][parameter] = value;
            }
        });        
    }

    generateProperties(properties) {
        let self = this;
        for(let element in properties) {
            if (properties.hasOwnProperty(element)) {
                Object.defineProperty(self, toCamelCase(element), {
                    enumerable: true,
                    //configurable: true,
                    get: function() {
                        let result = null; 
                        self.data[1].forEach(elt => {
                            if (elt[0] === element) {
                                if (result) {
                                    if (Array.isArray(result)) {
                                        result.push(elt[3]);
                                    } else {
                                        result = [ result ];
                                        result.push(elt[3]);
                                    }
                                } else {
                                    result = elt[3];
                                }
                            }
                        });
                        return result;
                    },
                    set: function(value) {
                        let updated = false;
                        if (value === undefined || Array.isArray(value)) {
                            self.data[1] = self.data[1].filter(elt => elt[0] !== element);
                            /*let idx = self.data[1].findIndex(elt => elt[0]===element);
                            self.data[1].splice(idx,1);*/
                            updated = true;
                        } 

                        if (Array.isArray(value)) {
                            value.forEach(v => {
                                self.data[1].push([element, {}, properties[element].type, v]);
                            });
                        } else {
                            self.data[1].forEach(elt => {
                                if (elt[0] === element) {
                                    elt[3] = value;
                                    updated = true;
                                }
                            })
                            // TODO: check a little bit more what we are writing.
                            if (!updated)
                                self.data[1].push([element, {}, properties[element].type, value]);
                        }
                    }
                });
            }
        }

    }

    addComponent(component) {
        this.#data[2].push(component.data);
    }
}

class Todo extends Component {
    constructor(data) {
        if (data) {
            super(data);
        } else {
            super('vtodo');
        }
        this.generateProperties(TodoProperties);
    }

    addComponent(component) {} // does nothing since a todo cannot have components
}

class Calendar extends Component {
    constructor(data) {
        if (data) {
            super(data);
        } else {
            super('vcalendar');
        }
        this.generateProperties(CalendarProperties);
    }

    static default() {
        let cal = new Calendar();
        cal.prodid = '-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN';
        cal.version = '2.0';
        return cal;
    }
}

export {Component, Calendar, Todo};