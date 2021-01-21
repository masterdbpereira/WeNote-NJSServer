const { LoginManager, FileAccessManager } = require("./managers");
const { STATUS, NTF_TYPE } = require("./messages");


// Periodic functions
function periodic_notify(io, logins)
{
    logins.dispatch_ntfs(io);
    setTimeout(periodic_notify, 1000, io, logins);
}


// sdata is an object of class ServerData
exports.build_io = function(sdt, io)
{
    //notify_boards = new NList_Generic();
    logins = new LoginManager();
    files = new FileAccessManager();

    
    io.on("connection", (socket) => {
        console.log("Connected");

        socket.on("disconnect", () => {
            logins.logout(socket.id);
        });

        socket.on("login", data => {
            let user = sdt.get_user_email(data.email);
            if (user === null)
            {
                io.to(socket.id).emit("login_ret", 
                    { status: STATUS.EMAIL_NOT_REGISTERED, data: null });
                return;
            }

            if (user.password != data.password)
            {
                io.to(socket.id).emit("login_ret", 
                    { status: STATUS.WRONG_PASSWORD, data: null });
                return;
            }

            logins.login(socket.id, user.id);

            user = user.personal_data();
            user.files = sdt.user_files(user.id).map(f => f.header());
            io.to(socket.id).emit("login_ret", 
                {status: STATUS.OK, data: user});
        });

        socket.on("register_user", data => {
            let user = sdt.get_user_email(data.email);
            if (user != null)
            {
                io.to(socket.id).emit("register_user_done", { status: STATUS.EXISTS });
                return;
            }
            user = sdt.new_user(data.name, data.email, data.password);
            io.to(socket.id).emit("register_user_done", { status: STATUS.OK });
        });

        

        
        // User
        socket.on("logout", data => {
            const user = active_users.remove(socket.id);
        });

        socket.on("user_ntf_close", data => {
            sdt.delete_ntf(data.user_id, data.ntf_id);
        });



        // Files
        socket.on("file_create", data => {
            sdt.new_file(data.user_id, data.title);
        });


        socket.on("file_invite_user", data => {
            let file = sdt.get_file(data.file_id);
            if (!file)
            {
                io.to(socket.id).emit("file_invite_user_done", {status: STATUS.NOT_FOUND, data: null});
                return;
            }
            if (file.user_in(data.user_id))
            {
                io.to(socket.id).emit("file_invite_user_done", {status: STATUS.EXISTS, data: null});
                return;
            }

            let header = file.header();
            let ntf = sdt.new_notification(data.user_id, "You've been added to '" + file.name + "'.");

            logins.notify_user(data.user_id, NTF_TYPE.FILE_INVITE, header);
            logins.notify_user(data.user_id, NTF_TYPE.USER_NEW_NTF, ntf);

            io.to(socket.id).emit("file_invite_user_done", {status: STATUS.OK, data: null});
        });


        socket.on("file_remove_user", data => {

        });


        socket.on("file_open", data => {

        });


        socket.on("file_close", data => {

        });


        socket.on("file_edit", data => {

        });



        // Control panel messages
        socket.on("cpanel_issue_ntf", data => {
            let ntf = sdt.new_notification(data.user_id, data.contents);
            active_users.notify(data.user_id, NTF_TYPE.USER_NEW_NTF, ntf);
            console.log("Issued notification to user " + data.user_id);
            io.to(socket.id).emit("cpanel_issue_ntf_done", null);
        });

        socket.on("cpanel_save", data => {
            sdt.save(() => {
                console.log("Issued save command completed. Database saved.");
                io.to(socket.id).emit("cpanel_save_done", null);
            });
        });
    });

    // Start periodic updates
    setTimeout(periodic_notify, 1000, io, logins);
}
