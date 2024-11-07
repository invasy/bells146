"use strict";

const LOCALE = "ru-RU";
const TIME_FORMAT = new Intl.NumberFormat(LOCALE, {minimumIntegerDigits: 2});

function dow() {
  return (new Date()).getDay();
}

class Time {
  #minutes = 0;

  constructor(hour, minute=undefined) {
    if (typeof minute === "undefined") {
      this.#minutes = hour;
    } else {
      this.#minutes = 60 * hour + minute;
    }
  }

  static fromDate(date) {
    return new Time(date.getHours(), date.getMinutes());
  }

  static now() {
    return Time.fromDate(new Date());
  }

  get hour() {
    return Math.floor(this.#minutes / 60) % 24;
  }

  get minute() {
    return this.#minutes % 60;
  }

  get second() {
    return 0;
  }

  get value() {
    return this.#minutes;
  }

  toString() {
    const h = TIME_FORMAT.format(this.hour);
    const m = TIME_FORMAT.format(this.minute);
    return `${h}:${m}`;
  }

  add(minutes) {
    return new Time(this.#minutes + minutes);
  }

  sub(other) {
    return new Time(this.value - other.value);
  }
}

class Period {
  start;
  duration = 0;

  constructor(start, duration) {
    this.start = start;
    this.duration = duration;
  }

  toString() {
    throw new Error(`Method '${this.constructor.name}.toString()' is not implemented!`);
  }

  get end() {
    return this.start.add(this.duration);
  }
}

class Lesson extends Period {
  n = 0;

  constructor(n, start, duration=45) {
    super(start, duration);
    this.n = n;
  }

  toString() {
    return `${this.n} урок`;
  }
}

class Break extends Period {
  toString() {
    return `Перемена (${this.duration} минут)`;
  }
}

class DayTimetable extends Array {
  #next = null;

  #index(time) {
    let a = 0, b = this.length - 1;
    while (a < b) {
      const c = (a + b) >> 1, period = this[c];
      if (time.value < period.start.value) {
        b = c;
      } else if (time.value >= period.end.value) {
        a = c + 1;
      } else {
        return c;
      }
    }
    return a;
  }

  at(time) {
    if (typeof time === "number") {
      return super.at(time);
    }

    if (this.length === 0) { throw new Error("Сегодня нет уроков"); }
    if (time.value < this.start?.value) { throw new Error("Уроки ещё не начались"); }
    if (time.value >= this.end?.value) { throw new Error("Уроки уже закончились"); }

    const i = this.#index(time);
    return [this[i], (i < this.length - 1 ? this[i + 1] : null)];
  }

  get start() {
    return this.length !== 0 ? this[0].start : null;
  }

  get end() {
    return this.length !== 0 ? this[this.length - 1].end : null;
  }

  get now() {
    return this.at(Time.fromDate(new Date()));
  }
}

class Timetable extends Array {
  #LESSON = 45;
  #START = [new Time(9, 30), new Time(9, 0), new Time(8, 30)];
  #START_DOW = [0, 1, 1, 0, 1, 2];
  #BREAKS = [10, 10, 20, 20, 10, 10, 10];
  #BREAKS_DOW = [1, 0, 0, 1, 0, 0];

  constructor() {
    super();
    for (const dow of Array(6).keys()) {
      let t = this.#START[this.#START_DOW[dow]];
      const i = this.#BREAKS_DOW[dow];
      const breaks = this.#BREAKS.slice(i, i + 6);
      const day = new DayTimetable();
      for (const n of Array(7).keys()) {
        day.push(new Lesson(n + 1, t, this.#LESSON));
        t = t.add(this.#LESSON);
        if (n < breaks.length) {
          const b = breaks[n];
          day.push(new Break(t, b));
          t = t.add(b);
        }
      }
      this.push(day);
    }
  }

  get today() {
    const d = dow();
    return d > 0 ? this.at(d - 1) : null;
  }

  get now() {
    return this.today?.now;
  }
}

function showTable() {
  document.getElementById("timetable").style.display = "flex";
  document.getElementById("banner").style.display = "none";
}

function showMessage(message) {
  document.getElementById("timetable").style.display = "none";
  document.getElementById("banner").style.display = "flex";
  document.getElementById("message").innerText = message;
}

function toDateString(date) {
  return date.toLocaleString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function showTimetable(){
  const ids = ["today", "now", "period", "time_left", "next_start", "next_period"];
  const fields = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  const timetable = new Timetable();
  setInterval(function() {
    const now = new Date();
    const time = Time.fromDate(now);
    try {
      const [period, next] = timetable.today.at(time);
      const time_left = period.end.sub(time);
      showTable();
      fields.today.innerText = toDateString(now);
      fields.now.innerText = time;
      fields.period.innerText = period;
      fields.time_left.innerText = time_left;
      fields.next_start.innerText = next ? next.start : period.end;
      fields.next_period.innerHTML = next || "<i>Завершение учебного дня</i>";
    } catch ({name, message}) {
      showMessage(message);
    }
  }, 1000);
}

function onLoaded(fn) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(fn, 1);
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}

onLoaded(showTimetable);
