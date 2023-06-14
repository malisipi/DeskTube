"use strict";

dv.mobile = !!navigator.userAgentData?.mobile || navigator.userAgent.includes("Mobile");
dv.network_saving = navigator.connection?.type == "cellular";
dv.__parse_time = (the_time) => {
    let splited_time = the_time.split(":");
    let parsed_time = Number(splited_time[0]) * 60;
    parsed_time = (parsed_time + Number(splited_time[1])) * 60;
    let [seconds, mseconds] = splited_time[2].split(".");
    parsed_time += Number(seconds) + (Number(mseconds) / 1000);
    return parsed_time;
};
dv.apply_styles = async () => {
    let accent_color = await dv.storage.conf.get("accent-color");
    if(!!accent_color){
        document.body.style.setProperty("--accent-color", accent_color);
    }
    if(dv.type == "main"){
        if(await dv.storage.conf.get("custom-background")==1){
            let params = await dv.storage.conf.get("custom-background-data");
            document.body.setAttribute("custom-background", true);
            document.body.querySelector("img.background").src = dv.backend.get_random_image(
                Math.round(window.devicePixelRatio * screen.width),
                Math.round(window.devicePixelRatio * screen.height),
                "wolves");
        }
    }
};
dv.controller = {
    titlebar: null,
    taskbar_id: NaN,
    init: () => {
        dv.controller.titlebar = parent.document.querySelector("iframe[src*=\""+document.location.pathname?.split("/")?.at(-1)+"\"][src*=\""+dv.window_id+"\"]")?.parentElement?.shadowRoot?.querySelector(".app-titlebar");
    },
    title: (title) => {
        if (!!dv.controller.titlebar) {
            dv.controller.titlebar.querySelector(".app-titlebar--title").innerText = title;
        }
        document.title = title;
    },
    close: () => {
        if (!!dv.controller.titlebar) {
            dv.controller.titlebar.querySelector(".app-titlebar--close").click();
        }
        /*if(!!dv.controller.taskbar_id >= 0){
            window.top.document.querySelector("app-taskbar").remove_window(dv.controller.taskbar_id);
        }*/
        window.close();
    }
};
dv.open = {
    video: async (id, title = "") => {
        let window_id = Date.now();
        let window_url = "./windows/player.html?wid="+window_id+"&id="+id+"&title="+encodeURIComponent(title);

        if(!dv.force_window){
            dv.hide_all();
            let video_window = document.createElement("app-window");
            video_window.title = title;
            video_window.className = "video";
            document.body.append(video_window);
            let iframe = document.createElement("iframe");
            iframe.src = window_url + "&embed=true";
            dv.init.window(video_window);
            video_window.onminimize = (_window=video_window, _title=title) => {
                document.querySelector("app-taskbar").new_window(title, (_id, __window=_window) => {
                    __window.removeAttribute("minimized");
                    document.querySelector("app-taskbar").remove_window(_id);
                });
            }
            video_window.append(iframe);
        } else {
            window.open(window_url + "&embed=false", "_blank", "popup=yes");
        }
    },
    list: async (window_id = dv.window_id, title = "Playlist") => {
        let window_url = "./windows/list.html?wid="+window_id;

        if(dv.embed){
            window.top.dv.hide_all();
            let list_window = document.createElement("app-window");
            list_window.title = title;
            list_window.className = "list";
            window.top.document.body.append(list_window);
            let iframe = document.createElement("iframe");
            iframe.src = window_url + "&embed=true";
            window.top.dv.init.window(list_window);
            list_window.onminimize = (_window=list_window, _title=title) => {
                window.top.document.querySelector("app-taskbar").new_window(title, (_id, __window=_window) => {
                    __window.removeAttribute("minimized");
                    window.top.document.querySelector("app-taskbar").remove_window(_id);
                });
            }
            list_window.append(iframe);            
        } else {
            if (await dv.storage.conf.get("floating-list") == 1 && 'documentPictureInPicture' in window) {
                const pip_window = await documentPictureInPicture.requestWindow({width: 300, height: 800});
                pip_window.document.write((await (await fetch("list.html")).text()));
                pip_window.document.write("<window_id>" + window_id + "</window-id>");
                pip_window.document.write("<script src=\"./js/wpip-init.js\"></script>");
            } else {
                window.open(window_url.replace("./windows/", "") + "&embed=false", "_blank", "popup=yes");
            }
        }
    },
    settings: (title = "Settings") => {
        window.top.document.querySelector("app-window.settings")?.querySelector("iframe")?.contentWindow?.dv?.controller?.close(); // Close previously created settings window

        let window_id = Date.now();
        let window_url = "./windows/settings.html?wid="+window_id;

        if(!dv.force_window){
            window.top.dv.hide_all();
            let settings_window = document.createElement("app-window");
            settings_window.title = title;
            settings_window.className = "settings";
            window.top.document.body.append(settings_window);
            let iframe = document.createElement("iframe");
            iframe.src = window_url + "&embed=true";
            window.top.dv.init.window(settings_window);
            settings_window.onminimize = (_window=settings_window, _title=title) => {
                document.querySelector("app-taskbar").new_window(title, (_id, __window=_window) => {
                    __window.removeAttribute("minimized");
                    document.querySelector("app-taskbar").remove_window(_id);
                });
            }
            settings_window.append(iframe);
        } else {
            window.open(window_url + "&embed=false", "_blank", "popup=yes");
        }
    }
}

dv.broadcast = {
    channel: new BroadcastChannel("deskvideo"),
    listener: (e) => {
        if (location.origin!=e.origin) return;

        console.log(e.data);
        switch (e.data.type){
            case "player_close": {
                if(dv.window_id == e.data.wid){
                    if(dv.type == "list") {
                        dv.controller.close();
                    }
                }
                break;
            }
            case "player_next": {
                if(dv.window_id == e.data.wid){
                    if(dv.type == "player") {
                        dv.render.player(e.data.video_id);
                    }
                }
                break;
            }
            case "list_update": {
                if(dv.window_id == e.data.wid){
                    if(dv.type == "list"){
                        dv.render.list(e.data.list);
                        break;
                    }
                }
            }
            case "list_init": {
                if(dv.window_id == e.data.wid){
                    if(dv.type == "list") {
                        dv.controller.close();
                    } else if (dv.type == "player"){
                        dv.render.list();
                    };
                };
            }
        }
    },
    post: (e) => {
        dv.broadcast.channel.postMessage(e);
    },
    init: ()=>{
        dv.broadcast.channel.onmessage = dv.broadcast.listener;
    }
};