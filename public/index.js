const socket = io();

socket.on('connect', () => {
    console.log("connected");

    socket.on('graph', (data) => {

        var chart = anychart.graph(data);

        var txs = chart.group("tx");

        txs.normal().height(15);
        txs.normal().shape("diamond");
        txs.normal().fill("orange");

        txs.hovered().height(15);
        txs.hovered().shape("diamond");
        txs.hovered().fill("white");

        txs.selected().height(15);
        txs.selected().shape("diamond");
        txs.selected().fill("black");

        chart.tooltip().useHtml(true);
        //chart.tooltip().hideDelay(1000);
        chart.tooltip().selectable(true);

        chart.edges().normal().stroke("#ffa000", 2, "5 0", "round");
        chart.edges().hovered().stroke("#ffa000", 4, "5 0", "round");
        chart.edges().selected().stroke("#ffa000", 4);

        chart.tooltip().format(function() {

            if(this.type == "edge"){
                return this.getData("tip") + "\n" + this.getData("val") + " BTC\n";
                /*'<div style="border: 2px solid #D5CC5A; overflow: hidden; margin: 15px auto; max-width: 575px;"><iframe scrolling="no" src="https://www.blockchain.com/btc/address/1KEZVroPWqamicxTGoAPcgCpGe3KBVw1c8" style="border: 0px none; margin-left: -36px; height: 812px; margin-top: -100px; width: 650px;"></iframe></div>';*/
            }

            if (this.kc.yg.f.group == "adr") {

                return this.getData("id") + "\n" + this.getData("balance") + " BTC";
            } 
            else if((this.kc.yg.f.group == "tx")){

                return this.getData("id") + "\ntime: " + this.getData("time");
            }
        });

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
        iter = document.getElementById("iter").value;
        dest = 0;
    }

    socket.emit("track",src,dest,iter);
}

