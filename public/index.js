const socket = io();

socket.on('connect', () => {
    console.log("connected");

    socket.on('new data', (data) => {
        console.log("geldi",data);
        var chart = anychart.graph(data);
        chart.edges().tooltip().format("from: {%from}\nto: {%to}\nvalue: {%val} BTC\ntime: {%time}")
        // set the title
        chart.title("Tx Graph");
        // draw the chart
        chart.container("result").draw();
    });

});

function track(){

    document.getElementById("result").innerHTML = "";

    src = document.getElementById("src").value;
    dest = document.getElementById("dest").value;
    console.log(src,dest);
    socket.emit("track",src,dest);
}

