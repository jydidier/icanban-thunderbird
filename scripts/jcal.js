
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
    'last-mod' : { type: 'date-time', unique: true},
    'location' : { type: 'text', unique : true},
    //'organizer' : { type: 'cal-address', unique: true},
    'percent' : { type: 'integer', unique: true},
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
}


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
                this.#data[2].forEach(element => {
                    if (element[0] === type) {
                        return new Component(element);
                    }
                });
                return null;
            } else {
                return new Component(this.#data[2][0]);
            }
        }
        return null;
    }
}

class Todo extends Component {
    constructor(data) {
        let self = this;
        if (data) {
            super(data);
        } else {
            super('vtodo');
        }

        for(element in TodoProperties) {
            if (TodoProperties.hasOwnProperty(element)) {
                Object.defineProperty(self, element, {
                    writable: true,
                    get: function() { 
                        self.data[1].forEach(elt => {
                            if (elt[0] === element) {
                                return elt[3];
                            }
                        });
                        return null;
                    },
                    set: function(value) {
                        self.data[1].forEach(elt => {
                            if (elt[0] === element) {
                                elt[3] = value;
                                return ;
                            }
                        })
                        // TODO: check a little bit more what we are writing.
                        self.data[1].push([element, {}, TodoProperties[element].type, value]);
                    }
                });
            }
        }
    }
}

export default {Component, Todo};