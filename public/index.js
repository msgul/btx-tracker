const socket = io();

socket.on('connect', () => {
    console.log("connected");

    socket.on('graph', (data) => {

        var chart = anychart.graph(data);

        var txs = chart.group("tx");

        txs.normal().height(20);
        txs.normal().shape("diamond");
        txs.normal().fill("orange");

        txs.hovered().height(20);
        txs.hovered().shape("diamond");
        txs.hovered().fill("white");

        txs.selected().height(20);
        txs.selected().shape("diamond");
        txs.selected().fill("black");

        //chart.group("tx").labels().enabled(true);

        chart.group("tx").labels().format("{%time}");
        //chart.group("adr").labels().format("{%balance} BTC");

        chart.edges().tooltip().format("value: {%val} BTC\ntype: {%tip}");
        chart.nodes().tooltip().format("hash: {%id}")
        // set the title
        chart.title("Tx Graph");
        // draw the chart
        chart.container("result").draw();
    });

});

function track(track_mode){

    document.getElementById("result").innerHTML = "";
    var src,dest;

    if(track_mode == "tx_track"){
        src = document.getElementById("src").value;
        dest = document.getElementById("dest").value;
    }
    else{
        src = document.getElementById("adr").value;
        dest = 0;
    }

    socket.emit("track",src,dest);
}

