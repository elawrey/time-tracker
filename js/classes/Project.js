class Project extends PersistentObject {
    constructor(timeTracker, name, bgColourIndex, order, key=null) {
        if (key === null) {
            super(Project.keyPrefix, false);
        } else {
            super(key, true);
        }

        this.timeTracker = timeTracker;
        this.name = name;
        this.bgColourIndex = bgColourIndex;
        this.order = order;
        this.logs = [];

        // Create the JQuery element
        this.markup = $(`
            <div class="project" draggable="true" data-projectkey="${this.getKey()}" style="background-color: ${this.getBackgroundColour()}">
                <h2 class="title">${Utils.escapeHTML(this.getName())}</h2>
                <div class="logs"></div>
                <div class="buttons"><button class="start">Start</button></div>
            </div>
        `);
    }

    static get keyPrefix() {
        return "project";
    }

    static getBackgroundColours() {
        return [
            "#ccffff",
            "#ccccff",
            "#ffccff",
            "#ffcccc",
            "#ffffcc",
            "#ccffcc",
            "#cccccc"
        ];
    }

    static getBackgroundColour(colourIndex) {
        const colours = Project.getBackgroundColours();
        return colours[colourIndex % colours.length];
    }

    static load(timeTracker, jsonProject) {
        return new Project(
            timeTracker,
            jsonProject.name,
            jsonProject.bgColourIndex,
            jsonProject.order,
            jsonProject.key
        );
    }

    loadLogs() {
        this.logs = Log.getAll(this.timeTracker, this.getKey());

        const logsEl = this.markup.find(".logs");
        let lastLog = null;
        $.each(this.logs, function(project, logsEl) {
            return function(index, log) {
                project.addLogDate(lastLog, log);
                logsEl.append(log.getMarkup());

                if (log.getEndDate() === null) {
                    project.timeTracker.startLogCounter(log);
                }

                lastLog = log;
            };
        }(this, logsEl));
    }

    addEventListeners() {
        // Drag and drop events
        // See: https://www.w3schools.com/html/html5_draganddrop.asp

        // Save dragged project key in the event
        // this = dragged project
        this.markup.on("dragstart", function(draggedProject) {
            return function(event) {
                event.originalEvent.dataTransfer.setData("text", draggedProject.getKey());
            };
        }(this));

        // Tell the browser the project can be dropped on another project
        // this = project under the dragged project
        this.markup.on("dragover", function(event) {
            event.preventDefault();
        });

        // The dragged project was drop on another project
        // this = drop on project
        this.markup.on("drop", function(dropOnProject) {
            return function(event) {
                event.preventDefault();
                const draggedProjectKey = event.originalEvent.dataTransfer.getData("text");
                const draggedProject = dropOnProject.timeTracker.getProject(draggedProjectKey);

                draggedProject.moveOn(dropOnProject);
            };
        }(this));

        // Add click event on start button
        this.markup.find("button.start").click(function(project) {
            return function() {
                project.addLog();
            };
        }(this));

        // Add click event on title (edit)
        this.markup.find("h2.title").click(function(project) {
            return function() {
                // Hide the title (it will be replaced with a input field)
                const titleEl = $(this);
                titleEl.hide();

                // Create an input field, add it in the markup after the (hidden) title
                const inputEl = $(`<input class="title" type="text" value="${Utils.escapeHTML(project.getName())}">`);
                titleEl.after(inputEl);
                inputEl.select(); // Select the text in the text field

                const changeFunction = function(project, inputEl) {
                    return function() {
                        // Get the new project name that was typed
                        const newName = inputEl.val();

                        // Set the new name on the markup and in the Project object
                        titleEl.html(Utils.escapeHTML(newName));
                        project.setName(newName);
                        project.save();

                        // Delete the input field and show the changed title
                        inputEl.remove();
                        titleEl.show();
                    };
                }(project, inputEl);

                // Update the project name when
                inputEl.change(changeFunction); // The user tape "enter"
                inputEl.focusout(changeFunction); // The user click somewhere else in the page
            };
        }(this));

        $.each(this.logs, function(index, log) {
            log.addEventListeners();
        });
    }

    moveOn(dropOnProject) {
        if (dropOnProject !== this) {
            const draggedProjectOrder = this.getOrder();
            const dropOnProjectOrder = dropOnProject.getOrder();
            const newOrder = dropOnProjectOrder;
            if (draggedProjectOrder > dropOnProjectOrder) {
                $.each(this.timeTracker.getProjectMap(), function(projectKey, project) {
                    let projectOrder = project.getOrder();
                    if (projectOrder >= dropOnProjectOrder && projectOrder < draggedProjectOrder) {
                        project.setOrder(projectOrder + 1);
                        project.save();
                    }
                });
            } else if (draggedProjectOrder < dropOnProjectOrder) {
                $.each(this.timeTracker.getProjectMap(), function(projectKey, project) {
                    let projectOrder = project.getOrder();
                    if (projectOrder <= dropOnProjectOrder && projectOrder > draggedProjectOrder) {
                        project.setOrder(projectOrder - 1);
                        project.save();
                    }
                });
            }
            this.setOrder(newOrder);
            this.save();

            this.timeTracker.fixProjectOrder();
        }
    }

    addLog() {
        const lastLog = this.getLastLog();
        const log = new Log(this, this.guessNextLogName(), Utils.getCurrentTimestamp(), null);
        log.save();
        this.logs.push(log);

        this.addLogDate(lastLog, log);
        this.markup.find(".logs").append(log.getMarkup());
        log.addEventListeners();

        this.timeTracker.startLogCounter(log);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const logsEl = this.markup.find(".logs");
        logsEl.prop("scrollTop", logsEl.prop("scrollHeight"));
    }

    addLogDate(previousLog, log) {
        let logDate = null;
        if (previousLog === null) {
            logDate = Utils.formatDate(log.getStartDate());
        } else {
            const previousDateStr = Utils.formatDate(previousLog.getStartDate());
            const currentDateStr = Utils.formatDate(log.getStartDate());
            if (previousDateStr !== currentDateStr) {
                logDate = currentDateStr;
            }
        }

        if (logDate !== null) {
            this.markup.find(".logs").append(`<div class="date">${logDate}</div>`);
        }
    }

    getLogs() {
        return this.logs;
    }

    getMarkup() {
        return this.markup;
    }

    setActive(active) {
        if (active) {
            this.markup.addClass('active');
        } else {
            this.markup.removeClass('active');
        }
    }
    isActive() {
        this.markup.hasClass('active');
    }

    getName() {
        return this.name;
    }
    setName(name) {
        this.name = name;
    }

    getLastLog() {
        if (this.logs !== null && this.logs.length > 0) {
            return this.logs[this.logs.length - 1];
        }
        return null;
    }

    guessNextLogName() {
        const lastLog = this.getLastLog();
        if (lastLog !== null) {
            return lastLog.getMessage();
        }
        return this.name;
    }

    getBackgroundColourIndex() {
        return this.bgColourIndex;
    }
    setBackgroundColourIndex(bgColourIndex) {
        const colours = Project.getBackgroundColours();
        this.bgColourIndex = bgColourIndex % colours.length;
    }

    getBackgroundColour() {
        return Project.getBackgroundColour(this.bgColourIndex);
    }

    getOrder() {
        return this.order;
    }
    setOrder(order) {
        this.order = order;
    }

    toJson() {
        return {
            "key": this.getKey(),
            "name": this.name,
            "bgColourIndex": this.bgColourIndex,
            "order": this.order
        }
    }

    // Override
    delete() {
        $.each(this.logs, function(index, log) {
            log.delete();
        });
        super.delete();
    }
}
