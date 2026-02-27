let menu = document.getElementById("menu");
let menuButton = document.getElementById("menu-button");
    
menuButton.addEventListener("click", function (e) {
    e.stopPropagation(); 
    menu.classList.toggle("hidden");
     menu.style.transform = "rotate(0deg) translate(0px,0px)"
});

function rotate(){
    let line = document.getElementsByClassName("bars");
    line[0].style.transform = "rotate(0deg) translate(15px,40px)"
    line[1].style.transform = "rotate(90deg) translate(20px,0px)"
    line[2].style.transform = "rotate(90deg) translate(6px,0px)"
    line[3].style.transform = "rotate(0deg) translate(-15px,-10px)"
    line[4].style.transform = "rotate(0deg) translate(-20px,-30px)"
    line[5].style.transform = "rotate(90deg) translate(-10px,50px)"
    line[6].style.transform = "rotate(90deg) translate(-10px,20px)"
    line[7].style.transform = "rotate(0deg) translate(-70px,10px)"
}
function unrotate(){
    let line = document.getElementsByClassName("bars");
    line[0].style.transform = "rotate(0deg) translate(0,0)"
    line[1].style.transform = "rotate(0deg) translate(0,0)"
    line[2].style.transform = "rotate(0deg) translate(0,0)"
    line[3].style.transform = "rotate(0deg) translate(0,0)"
    line[4].style.transform = "rotate(0deg) translate(0,0)"
    line[5].style.transform = "rotate(0deg) translate(0,0)"
    line[6].style.transform = "rotate(0deg) translate(0,0)"
    line[7].style.transform = "rotate(0deg) translate(0,0)"
}