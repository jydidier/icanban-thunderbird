
// hypothesis: calendar is not needed for the properties
// however, the remaining ones are needed.
// basically, we need to be able to make things with a vtodo


/*const JCALCalendarProperties = [
    'calscale', //opt, unique
    'method', //opt, unique
    'prodid', //req, unique
    'version', //req, unique
]*/

const Types = [
    'binary', 'boolean', 'cal-address', 'date', 'date-time', 'duration', 
    'float', 'integer', 'period', 'recur', 'text', 'time', 'uri', 'utc-offset',
    'x-type'
];

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
    'duration': { type: 'duration', unique: true, conflict: 'due'}
    // starting from this point, all properties may not be unique
    //'attach' : { type: },
    //'attendee'
    //'categories'
    //'comment'
    //'contact'
    //'exdate'
    //'rstatus'
    //'related'
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
}

class Todo extends Component {
    constructor(data) {
        if (data) {
            super(data);
        } else {
            super('vtodo');
        }
        let self = this;

        for(let element in TodoProperties) {
            if (TodoProperties.hasOwnProperty(element)) {
                Object.defineProperty(self, toCamelCase(element), {
                    get: function() {
                        let result = null; 
                        self.data[1].forEach(elt => {
                            if (elt[0] === element) {
                                result = elt[3];
                            }
                        });
                        return result;
                    },
                    set: function(value) {
                        let updated = false;
                        self.data[1].forEach(elt => {
                            if (elt[0] === element) {
                                elt[3] = value;
                                updated = true;
                            }
                        })
                        // TODO: check a little bit more what we are writing.
                        if (!updated)
                            self.data[1].push([element, {}, TodoProperties[element].type, value]);
                    }
                });
            }
        }
    }
}

export {Component, Todo};