import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-analytics.js";
import { } from 'https://www.gstatic.com/firebasejs/9.9.3/firebase-auth.js';
import { getDatabase, ref, set, child, get, update, remove } from 'https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js';
import { getAuth, signInWithRedirect, getRedirectResult , GoogleAuthProvider, signOut } from 'https://www.gstatic.com/firebasejs/9.9.3/firebase-auth.js';

var brojPesama = 18;
var brojKreatora = 9;
var accountUsername;
var accountUserphotoURL;
var accountEmail;

const firebaseConfig = {
    apiKey: "AIzaSyBtHlJGvOX-dNiyWWUUzheaSl21fD3-WBA",
    authDomain: "crimsonmusic-b97d9.firebaseapp.com",
    projectId: "crimsonmusic-b97d9",
    storageBucket: "crimsonmusic-b97d9.appspot.com",
    messagingSenderId: "181983859666",
    appId: "1:181983859666:web:9afcaab406d031dd092e0b",
    measurementId: "G-V7HPY7PHBR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const provider = new GoogleAuthProvider(app);
const auth = getAuth(app);

const realdb = getDatabase();

// Stvaranje kontenta

var content = document.getElementsByClassName('content')[0];

var openHome = document.getElementById('openHome');
var openSearch = document.getElementById('openSearch');
var openPlaylists = document.getElementById('openPlaylists');

openHome.addEventListener('click', ()=>{
    openSearch.classList.remove('activescreen');
    openHome.classList.add('activescreen');
    openPlaylists.classList.remove('activescreen');
    skloniArtista();
})

openSearch.addEventListener('click', ()=>{
    openSearch.classList.add('activescreen');
    openHome.classList.remove('activescreen');
    openPlaylists.classList.remove('activescreen');
    const searchInp = document.getElementById('searchbox');
    skloniArtistaSearch();
    searchInp.focus();
})

openPlaylists.addEventListener('click', ()=>{
    openSearch.classList.remove('activescreen');
    openHome.classList.remove('activescreen');
    openPlaylists.classList.add('activescreen');
    skloniArtistaPlaylists();
})

// LOADING SONG AND GETTING THE URL

var radioOn = false;
var webtitle = document.getElementById('webtitle');

var lastPlayedSongs = [];
var lastPlayedImageSongs = [];
var lastPlayedTitleSongs = [];
var lastPlayedCreaatorSongs = [];
let songPlayedId = 0;

var songToBePlayed;
var songTitle = 'empty';
var songCreator;
var imageURL;
var currentLI;
var currentImg;

var accountName = document.getElementById('accountName');
var accountPhoto;
var accountEmail;

var loggedIn = false;

var siteIcon = document.querySelector("link[rel*='icon']")

var currentTime = document.getElementsByClassName('currentTime')[0];
var endTime = document.getElementsByClassName('endTime')[0];

var playedFromSpot = document.getElementById('playedFromSpot');
var playedFrom = document.getElementById('playedFrom');

function GetUrlFromRealtimeDB(songName){
    var name = songName;

    var dbRef = ref(realdb);

    get(child(dbRef, "Songs/"+name)).then((snapshot)=>{
        if(snapshot.exists()){
            songToBePlayed = snapshot.val().SongURL;
            songTitle  = snapshot.val().SongName;
            songCreator = snapshot.val().Creator;
            imageURL = snapshot.val().ImgURL;
            currentLI =  `<li class="mightlike-songitem">
                <img src="`+ imageURL +`">
                <div class="title">
                    <h3>`+ songTitle +`</h3>
                    <h4>`+ songCreator +`</h4>
                </div>
                <i id="songHeart" class="bi bi-suit-heart"></i>
                <audio src="`+ songToBePlayed +`"></audio>
                <button name="mightlike" id="songItem"></button>
                </li>`;
            recSongs.innerHTML += currentLI;
            if(theme == 0){
                for (let i = 0; i < mightLikeSongItems.length; i++) {
                    mightLikeSongItems[i].style.backgroundImage = 'linear-gradient(225deg, rgba(220, 220, 255, 0.9), rgba(255, 255, 255, 0.9))';
                    mightLikeSongItems[i].children[1].children[0].style.color = 'black';
                    mightLikeSongItems[i].children[2].style.color = 'black';
                }
            }
        }
    })
}

function GetUrlFromRealtimeDB2(songName){
    var name = songName;

    var dbRef = ref(realdb);

    get(child(dbRef, "Songs/"+name)).then((snapshot)=>{
        if(snapshot.exists()){
            songToBePlayed = snapshot.val().SongURL;
            songTitle  = snapshot.val().SongName;
            songCreator = snapshot.val().Creator;
            imageURL = snapshot.val().ImgURL;
            document.getElementById('songBanner').src = imageURL;
            document.getElementById('currentSongName').innerHTML = songTitle;
            document.getElementById('currentSongCreator').innerHTML = songCreator;
            nextSong.src = songToBePlayed;
            trenutnaPesma.src = nextSong.src;
            trenutnaPesma.currentTime = 0;
            trenutnaPesma.play();
            webtitle.innerHTML = songTitle + ' | ' + songCreator;
            outerplayer.style.backgroundImage = 'url("'+ imageURL +'")';
            siteIcon.href = imageURL;
        }
    })
}

var artistName;
var artistImage;

function GetArtists(artistName){
    var name = artistName;

    var dbRef = ref(realdb);

    get(child(dbRef, "Artists/"+name)).then((snapshot)=>{
        if(snapshot.exists()){
            artistName = snapshot.val().Artist;
            artistImage = snapshot.val().ImageURL;
            currentImg =  `<img alt="`+ artistName +`" name="`+ name +`" id="artistItem" class="artistItem" 
            src="` + artistImage + `">`;
            recArtists.innerHTML += currentImg;
        }
    })
}

function GetArtistSongs(artistName,songName){
    var name = songName;

    var dbRef = ref(realdb);

    get(child(dbRef, "Songs/"+name)).then((snapshot)=>{
        if(snapshot.exists()){
            songToBePlayed = snapshot.val().SongURL;
            songTitle  = snapshot.val().SongName;
            songCreator = snapshot.val().Creator;
            imageURL = snapshot.val().ImgURL;

            currentLI = `
            <li class="artistSongItem">
                <img class="artistSongImage" src="`+ imageURL +`">
                <div class="title">
                    <h3>`+ songTitle +`</h3>
                    <h4>`+ songCreator +`</h4>
                </div>
                <button name="artistSong" id="songItem"></button>
                <audio src="`+ songToBePlayed +`"></audio>
                <i id="songHeart" class="bi bi-suit-heart"></i>
            </li>`;

            if(songCreator.includes(artistName)){
                artistSongs.innerHTML += currentLI;
            }

            if(songName == brojPesama){
                for (let i = 1; i <= 3; i++) {
                    artistSongs.innerHTML += `<div class="fill"></div>`;
                }
            }
        }
    })
}

function GetArtistDetails(artistName){
    var name = artistName;

    var dbRef = ref(realdb);

    get(child(dbRef, "Artists/"+name)).then((snapshot)=>{
        if(snapshot.exists()){
            artistName = snapshot.val().Artist;
            artistImage = snapshot.val().ImageURL;
            artistBanner.src = artistImage;
            artistName2.innerHTML = artistName;
            prikaziArtista(artistName);
        }
    })
}

var recSongs = document.getElementById('recsongs');
var recArtists = document.getElementById('recartists');

function generateSongs(){
    for (let i = 0; i < 5; i++) {
        var g = Math.floor(Math.random() * brojPesama) + 1;
        GetUrlFromRealtimeDB(g);
    }
}

function generateArtists(){
    for (let i = 0; i < 10; i++) {
        var g = Math.floor(Math.random() * brojKreatora) + 1;
        GetArtists(g);
    }
}

generateSongs();
generateArtists();

var refreshBtn = document.getElementById('refreshRecSongs');
refreshBtn.addEventListener('click', ()=>{
    refreshBtn.classList.add('activerefresh');
    document.getElementsByClassName('recsongs')[0].innerHTML = '';
    generateSongs();
    setTimeout(()=>{
        refreshBtn.classList.remove('activerefresh');
    }, 700);
})

// Account login stvari

var openAccount = document.getElementById('openAccount');
openAccount.addEventListener('click', ()=>{
    openAccountPage();
})

function openAccountPage(){
    loginPage.classList.add('loginPageActive');
}

function closeAccountPage(){
    loginPage.classList.remove('loginPageActive');
}

// Login sa Usernameom i sifrom brate kobasica

const username = document.getElementById('userInp');
const email = document.getElementById('emailInp');
const password = document.getElementById('passInp');
const signUpBtn = document.getElementById('signup');
const signInBtn = document.getElementById('signin');
const youhaveTxt = document.getElementsByClassName('youhave')[0];
const youdonthaveTxt = document.getElementsByClassName('youdonthave')[0];
const alreadyHasAccountBtn = document.getElementById('alreadyHasAccount');
const dontHaveAccountBtn = document.getElementById('dontHaveAccount');

var currentUser;

function isEmptyOrSpaces(str){
    return str == null || str.match(/^ *$/) !== null;
}

function Validation(){
    let emailregex = /^[a-zA-Z0-9]+@(gmail|yahoo|outlook)\.com$/;
    let userregex = /^[a-zA-Z0-9]{5,}$/;

    if(isEmptyOrSpaces(username.value) || isEmptyOrSpaces(email.value) ||
    isEmptyOrSpaces(password.value)){
        alert('Some fields are empty!');
        return false;
    }

    if(!emailregex.test(email.value)){
        alert('Email is not valid!');
        return false;
    }

    if(!userregex.test(username.value)){
        alert('Username is not valid and\nhas to have more than 5 characters!');
        return false;
    }

    return true;
}

function RegisterUser(){
    if(!Validation()){
        return;
    }
    const dbRef = ref(realdb);

    get(child(dbRef, "Users/"+username.value)).then((snapshot)=>{
        if(snapshot.exists()){
            alert('Account already exists!');
        }
        else{
            set(ref(realdb, "Users/"+username.value),
            {
                Username: username.value,
                Email: email.value,
                Password: encPass()
            })
            .then(()=>{
                alert('User registered sexesfuli');
            })
            .catch((error)=>{
                alert("error "+error);
            })
        }
    })
}

// Enkriptuj sifru

function encPass(){
    var pass12 = CryptoJS.AES.encrypt(password.value, password.value);
    return pass12.toString();
}

// Dugmici na login stranici

signUpBtn.addEventListener('click', RegisterUser);

alreadyHasAccountBtn.addEventListener('click', ()=>{
    loginPage.children[0].innerHTML = 'Sign In';
    signUpBtn.style.display = 'none';
    signInBtn.style.display = 'block';
    email.style.display = 'none';
    youhaveTxt.style.display = 'none';
    youdonthaveTxt.style.display = 'block';
})

dontHaveAccountBtn.addEventListener('click', ()=>{
    loginPage.children[0].innerHTML = 'Sign Up';
    signUpBtn.style.display = 'block';
    signInBtn.style.display = 'none';
    email.style.display = 'block';
    youhaveTxt.style.display = 'block';
    youdonthaveTxt.style.display = 'none';
})

// Sign inuj korisnika brate!

function AuthenticateUser(){
    const dbRef = ref(realdb);

    get(child(dbRef, "Users/"+username.value)).then((snapshot)=>{
        if(snapshot.exists()){
            let dbpass = decPass(snapshot.val().Password);
            if(dbpass == password.value){
                loginUser(snapshot.val());
            }
        }
        else{
            set(ref(realdb, "Users/"+username.value),
            {
                Username: username.value,
                Email: email.value,
                Password: encPass()
            })
            .then(()=>{
                alert('User registered sexesfuli');
            })
            .catch((error)=>{
                alert("error "+error);
            })
        }
    })
}

signInBtn.addEventListener('click', AuthenticateUser);

// Dekriptuj sifru

function decPass(dbpass){
    var pass12 = CryptoJS.AES.decrypt(dbpass, password.value);
    return pass12.toString(CryptoJS.enc.Utf8);
}

// Login user

function loginUser(user){
    localStorage.setItem('keepLoggedIn', 'yes');
    localStorage.setItem('user', JSON.stringify(user));
    getUsername();
    accountUsername = currentUser.Username;
    accountEmail = currentUser.Email;
    accountPhoto = 'noPhoto.png';
    accountName.innerHTML = accountUsername;
    stateTwoLoginPage();
}

// Dobij username i email

function getUsername(){
    let keepLoggedIn = localStorage.getItem('keepLoggedIn');

    if(keepLoggedIn == 'yes'){
        currentUser = JSON.parse(localStorage.getItem('user'));
    }
}

function SignOutUser(){
    localStorage.removeItem('user');
    localStorage.removeItem('keepLoggedIn');
    stateOneLoginPage();
}

// Windows loads
getUsername();

if(currentUser == null){
    stateOneLoginPage();
}
else{
    accountUsername = currentUser.Username;
    accountEmail = currentUser.Email;
    accountPhoto = 'noPhoto.png';
    stateTwoLoginPage();
}

// // Login With Googel

// var accountName = document.getElementById('accountName');
// var accountPhoto = document.getElementById('accountPhoto');

// getRedirectResult(auth)
//   .then((result) => {
//     // This gives you a Google Access Token. You can use it to access Google APIs.
//     const credential = GoogleAuthProvider.credentialFromResult(result);
//     const token = credential.accessToken;

//     // The signed-in user info.
//     const user = result.user;
//     closeAccountPage();

//     //username = displayName
//     //email = email
//     //photo = photoURL
//     setProfile(user);
//   }).catch((error) => {
//     // Handle Errors here.
//     const errorCode = error.code;
//     const errorMessage = error.message;
//     // The AuthCredential type that was used.
//     const credential = GoogleAuthProvider.credentialFromError(error);
//     // ...
//   });

// if(loggedIn == false){
// var googleSignInBtn = document.getElementById('googleSignIn');
// googleSignInBtn.addEventListener('click', ()=>{
//     signInWithRedirect(auth, provider);
// })
// }

// function setProfile(user){
//     accountPhoto.src = user.photoURL;
//     accountUsername = user.displayName;
//     accountName.innerHTML = accountUsername;
//     accountUserphotoURL = user.photoURL;
//     accountEmail = user.email;
//     RegisterUserGoogle(user);
//     stateTwoLoginPage();
// }

// function RegisterUserGoogle(user){
//     const dbRef = ref(realdb);

//     get(child(dbRef, "Users/"+user.displayName)).then((snapshot)=>{
//         if(snapshot.exists()){
//             alert('Account already exists!');
//         }
//         else{
//             set(ref(realdb, "Users/"+user.displayName),
//             {
//                 Username: user.displayName,
//                 Email: user.email,
//                 Password: "noPassGoogle"
//             })
//             .then(()=>{
//                 alert('User registered sexesfuli');
//             })
//             .catch((error)=>{
//                 alert("error "+error);
//             })
//         }
//     })
// }

// function loginUserGoogle(user){
//     localStorage.setItem('keepLoggedIn', 'yes');
//     localStorage.setItem('user', JSON.stringify(user));
//     getUsername();
//     accountUsername = currentUser.Username;
//     accountEmail = currentUser.Email;
//     accountPhoto = 'noPhoto.png';
//     accountName.innerHTML = accountUsername;
//     stateTwoLoginPage();
// }

// // Dobij username i email

// function getUsername(){
//     let keepLoggedIn = localStorage.getItem('keepLoggedIn');

//     if(keepLoggedIn == 'yes'){
//         currentUser = JSON.parse(localStorage.getItem('user'));
//     }
// }

// function SignOutUser(){
//     localStorage.removeItem('user');
//     localStorage.removeItem('keepLoggedIn');
//     stateOneLoginPage();
// }

function stateTwoLoginPage(){
    loginPage.children[0].innerHTML = 'Account';
    loginPage.children[1].style.display = 'none';
    loginPage.children[2].style.display = 'none';
    loginPage.children[3].style.display = 'none';
    loginPage.children[4].style.display = 'none';
    loginPage.children[5].style.display = 'none';
    loginPage.children[6].style.display = 'none';
    loginPage.children[7].style.display = 'none';
    loginPage.children[8].style.display = 'none';
    loginPage.children[9].style.display = 'block';
    loginPage.children[9].src = 'noPhoto.png';
    loginPage.children[10].style.display = 'block';
    loginPage.children[10].innerHTML = accountUsername;
    loginPage.children[11].style.display = 'block';
    loginPage.children[11].innerHTML = accountEmail;
    loginPage.children[12].style.display = 'block';
}

function stateOneLoginPage(){
    loginPage.children[0].innerHTML = 'Sign Up';
    loginPage.children[1].style.display = 'block';
    loginPage.children[2].style.display = 'block';
    loginPage.children[3].style.display = 'block';
    loginPage.children[4].style.display = 'block';
    loginPage.children[5].style.display = 'none';
    loginPage.children[6].style.display = 'block';
    loginPage.children[7].style.display = 'none';
    loginPage.children[8].style.display = 'block';
    loginPage.children[9].style.display = 'none';
    loginPage.children[10].style.display = 'none';
    loginPage.children[11].style.display = 'none';
    loginPage.children[12].style.display = 'none';
    accountUsername = 'Guest';
    accountName.innerHTML = accountUsername;
    accountUserphotoURL = 'noPhoto.png';
    accountPhoto = 'noPhoto.png';
}

var closeLoginPageBtn = document.getElementById('closeLoginPage');
closeLoginPageBtn.addEventListener('click', ()=>{
    closeAccountPage();
})

// Sign Out

var signOutBtn = document.getElementById('signOutBtn');
signOutBtn.addEventListener('click', ()=>{
    signOut(auth).then(() => {
        SignOutUser();
        loggedIn = false;
    }).catch((error) => {
        // An error happened.
    });
})

// app.js svari ------------------------------------
// Vreme ono good morning, evening...

window.onload = getTime();

function getTime(){
    var d = new Date();
    var time = d.getHours();

    if (time < 12) {
        document.getElementById('timeOfDay').innerHTML = 'Morning';
    }
    if (time >= 12 && time < 18) {
        document.getElementById('timeOfDay').innerHTML = 'Afternoon';
    }
    if (time >= 18) {
        document.getElementById('timeOfDay').innerHTML = 'Evening';
    }
    accountName.innerHTML = accountUsername;
}

// Kliktanje dugmica

var buttons = document.querySelectorAll('a');
buttons.forEach(btn =>{
    btn.addEventListener('click', ()=>{
        btn.classList.add('activeButton');

        setTimeout(() =>{
            btn.classList.remove('activeButton');
        }, 500);
    })
})

var buttons2 = document.querySelectorAll('i');
buttons2.forEach(btn =>{
    btn.addEventListener('click', ()=>{
        if(btn.id != 'refreshRecSongs'){
            btn.classList.add('activeIs');

            setTimeout(() =>{
                btn.classList.remove('activeIs');
            }, 500);
        }
    })
})

var buttons3 = document.getElementsByClassName('mightlike-songitem');
for(let i = 0; i<buttons3.length; i++){
    buttons3[i].addEventListener('click', ()=>{
            buttons3[i].classList.add('activeIs');

            setTimeout(() =>{
                buttons3[i].classList.remove('activeIs');
            }, 500);
    })
}

// Pustanje pesme u odnosu na pesmu koju je kliknuo

var nextBtn = document.getElementById('next');
var backBtn = document.getElementById('back');

var songPlaying = false;
var lastSong;
var pesma = new Audio();
var trenutnaPesma = new Audio();
trenutnaPesma.src = 'https://firebasestorage.googleapis.com/v0/b/crimsonmusic-b97d9.appspot.com/o/Songs%2F1.mp3?alt=media&token=54e2f635-d62d-491f-aaab-44ba18c77f65';
var outerplayer = document.getElementsByClassName('outerplayer')[0];

document.addEventListener('click', (e) =>
  {
    if(e.target.name == 'radio'){
        playedFromSpot.innerHTML = '<i class="bi bi-broadcast"></i>Radio';
    }
    let elementId = e.target.id;
    if(elementId == 'songItem'){

        trenutnaPesma.src = e.target.parentElement.children[3].src;

        if(e.target.name == 'mightlike'){
            playedFromSpot.innerHTML = 'You Might Like';
        }
        if(e.target.name == 'artistSong'){
            playedFromSpot.innerHTML = 'Artist Tab';
        }
        radioBtn.classList.remove('activeradio');
        radioOn = false;
        lastPlayedSongs[songPlayedId] = trenutnaPesma.src;
        songPlayedId++;
        outerplayer.classList.add('activeouterplayer');
        outerplayer.children[0].children[0].children[1].children[0].innerHTML = e.target.parentElement.children[1].children[0].innerHTML;
        outerplayer.children[0].children[0].children[1].children[1].innerHTML = e.target.parentElement.children[1].children[1].innerHTML;
        outerplayer.children[0].children[0].children[0].src = e.target.parentElement.children[0].src;
        trenutnaPesma.src = e.target.parentElement.children[3].src;
        if(songPlaying == false && trenutnaPesma != pesma){
            playSong();
            pesma.src = trenutnaPesma.src;
            lastSong = e.target;
        }
        else if(songPlaying == false && trenutnaPesma == pesma){
                trenutnaPesma.currentTime = 0;
                playSong();
                pesma.src = trenutnaPesma.src;
                lastSong = e.target;
        }
        else if(songPlaying && pesma == trenutnaPesma){
            trenutnaPesma.currentTime = 0;
        }
        else if(songPlaying && pesma != trenutnaPesma){
            pesma.pause();
            pesma.currentTime = 0;
            pesma.src = trenutnaPesma.src;
            lastSong = e.target;
            playSong();
        }
    }
    if(elementId == 'artistItem'){
        GetArtistDetails(e.target.name);
    }
  }
);

var header = document.getElementById('header');
var artistBanner = document.getElementById('artistBanner');
var artistName2 = document.getElementById('artistName');

function prikaziArtista(artistName){
    content.scrollTo(0, 0);
    content.children[0].style.display = 'none';
    content.children[1].style.display = 'none';
    content.children[2].style.display = 'none';
    content.children[3].classList.add('activeartist');
    content.children[3].style.transition = 'all 0.2s linear';
    header.classList.add('headerAway');
    content.classList.add('contentartist');
    generateArtistSongs(artistName);
}

var artistSongs = document.getElementById('artistSongs');

function generateArtistSongs(artistName){
    artistSongs.innerHTML = '';
    for (let i = 1; i <= brojPesama; i++) {
        GetArtistSongs(artistName,i);
    }
}

function skloniArtista(){
    content.children[0].style.display = 'block';
    content.children[1].style.display = 'block';
    content.children[2].style.display = 'none';
    content.children[3].classList.remove('activeartist');
    content.children[3].style.transition = 'all 0s linear';
    header.classList.remove('headerAway');
    content.classList.remove('contentartist');
}

function skloniArtistaSearch(){
    content.children[0].style.display = 'none';
    content.children[1].style.display = 'none';
    content.children[2].style.display = 'block';
    content.children[3].classList.remove('activeartist');
    content.children[3].style.transition = 'all 0s linear';
    header.classList.remove('headerAway');
    content.classList.remove('contentartist');
}

function skloniArtistaPlaylists(){
    content.children[0].style.display = 'none';
    content.children[1].style.display = 'none';
    content.children[2].style.display = 'none';
    content.children[3].classList.remove('activeartist');
    content.children[3].style.transition = 'all 0s linear';
    header.classList.remove('headerAway');
    content.classList.remove('contentartist');
}

var closeArtist = document.getElementById('closeArtist');
closeArtist.addEventListener('click', ()=>{
    skloniArtista();
})

// Player commands

var playButton = document.getElementById('masterPlay');
playButton.addEventListener('click', ()=>{
    if(songPlaying){
        pauseSong();
    }
    else{
        playSong();
    }
})

function pauseSong(){
    outerplayer.children[0].children[3].children[2].classList.add('bi-play-circle-fill');
    outerplayer.children[0].children[3].children[2].classList.remove('bi-pause-circle-fill');
    trenutnaPesma.pause();
    songPlaying = false;
}

function playSong(){
    outerplayer.children[0].children[3].children[2].classList.remove('bi-play-circle-fill');
    outerplayer.children[0].children[3].children[2].classList.add('bi-pause-circle-fill');
    trenutnaPesma.play();
    siteIcon.href = player.children[0].children[0].src;
    webtitle.innerHTML = outerplayer.children[0].children[0].children[1].children[0].innerHTML
    + ' | ' + outerplayer.children[0].children[0].children[1].children[1].innerHTML;
    songPlaying = true;
}

trenutnaPesma.addEventListener('ended', ()=>{
    if(songRepeat){
        trenutnaPesma.currentTime = 0;
        trenutnaPesma.play();
    }else if(radioOn){
        var g = Math.floor(Math.random() * brojPesama) + 1;
        GetUrlFromRealtimeDB2(g);
    }else{
        document.getElementById('songBanner').style.animation = 'none';
        pauseSong();
    }
})

trenutnaPesma.addEventListener('paused', ()=>{
    pauseSong();
})

var radioBtn = document.getElementById('openRadio');
radioBtn.addEventListener('click', ()=>{
    var g = Math.floor(Math.random() * brojPesama) + 1;
    GetUrlFromRealtimeDB2(g);
    outerplayer.classList.add('activeouterplayer');
    outerplayer.children[0].children[3].children[2].classList.remove('bi-play-circle-fill');
    outerplayer.children[0].children[3].children[2].classList.add('bi-pause-circle-fill');
    player.style.backgroundImage = `url('radioback.gif')`;
    songPlaying = true;
    radioOn = true;
    radioBtn.classList.add('activeradio');
    openBigPlayer();
})

function setPlayerBackground(){
    player.style.backgroundImage = `none`;
}

// Seek input | vreme pesme

var customFollow = document.getElementById('customFollow');
var customDot = document.getElementById('customDot');
var songTime = document.getElementById('songTime');

songTime.addEventListener('change', ()=>{
    var seekto = trenutnaPesma.duration * (songTime.value / 100);
    trenutnaPesma.currentTime = seekto;
})

trenutnaPesma.addEventListener('timeupdate', ()=>{

    let musicCurr = trenutnaPesma.currentTime;
    let musicDur = trenutnaPesma.duration;

    // End Time
    let min = Math.floor(musicDur / 60);
    let sec = Math.floor(musicDur % 60);
    if(sec<10){
        sec = `0${sec}`;
    }
    endTime.innerHTML = `${min}:${sec}`;

    //Curr Time
    let min2 = Math.floor(musicCurr / 60);
    let sec2 = Math.floor(musicCurr % 60);

    if(sec2<10){
        sec2 = `0${sec2}`;
    }

    currentTime.innerHTML = `${min2}:${sec2}`;

    let progressBar = parseInt((trenutnaPesma.currentTime/trenutnaPesma.duration)*100);
    songTime.value = progressBar;
    if(progressBar >= 98){
        customDot.style.left = '98%';
    }
    else{
        customDot.style.left = progressBar + "%";
    }
    customFollow.style.width = progressBar + "%";
    if(songPlaying == false){
        document.getElementById('songBanner').style.animation = 'none';
    }else{
        if(playerOpen){
            document.getElementById('songBanner').style.animation = 'da 0.75s linear infinite';
        }else{
            document.getElementById('songBanner').style.animation = 'none';
        }
    }
})

// Player

var playerOpen = false;

var player = document.getElementById('player');
var playerControls = document.getElementsByClassName('playercontrols')[0];

// Opening player

var openBigPlayerBtn = document.getElementById('openBigPlayer');
openBigPlayerBtn.addEventListener('click', ()=>{
    openBigPlayer();
})

function openBigPlayer(){
    outerplayer.style.backgroundImage = 'url("'+ player.children[0].children[0].src +'")';
    outerplayer.classList.add('openouterplayer');
    playedFrom.style.display = 'block';
    playerControls.classList.add('activeplcntrls');
    if(radioOn){
        player.style.backgroundImage = `url('radioback.gif')`;
        // backBtn.style.color = 'rgb(130, 130, 130)';
        backBtn.style.pointerEvents = 'none';
        // nextBtn.style.color = 'rgb(130, 130, 130)';
        nextBtn.style.pointerEvents = 'none';
    }else{
        setPlayerBackground();
        // backBtn.style.color = 'white';
        backBtn.style.pointerEvents = 'all';
        // nextBtn.style.color = 'white';
        nextBtn.style.pointerEvents = 'all';
    }
    playerOpen = true;
}

// Closing player

var closeBigPlayerBtn = document.getElementById('closeBigPlayer');
closeBigPlayerBtn.addEventListener('click', ()=>{
    closeBigPlayer();
    setPlayerBackground();
})

function closeBigPlayer(){
    outerplayer.style.backgroundImage = 'none';
    outerplayer.classList.remove('openouterplayer');
    playerControls.classList.remove('activeplcntrls');
    playedFrom.style.display = 'none';
    playerOpen = false;
}

if(playerOpen){
    document.addEventListener('backbutton', function(){
        closeBigPlayer();
    })
}

document.addEventListener('backbutton', function(){
    if(playerOpen) {
        closeBigPlayer();
     return false;
    }
    else
    {
      navigator.app.exitApp();
    }
});
document.addEventListener("backbutton", closeBigPlayer, false);

var songRepeat = false;
var repeatBtn = document.getElementById('repeat');
var nextSong = new Audio();

repeatBtn.addEventListener('click', ()=>{
    if(songRepeat == false){
        repeatBtn.style.color = 'orange';
        songRepeat = true;
    }else{
        repeatBtn.style.color = 'white';
        songRepeat = false;
    }
})

var lastImageURL, lastSongTitle, lastSongCreator;

nextBtn.addEventListener('click', ()=>{
    lastPlayedImageSongs[songPlayedId] = player.children[0].children[0].src;
    lastPlayedTitleSongs[songPlayedId] = player.children[0].children[1].children[0].innerHTML;
    lastPlayedCreaatorSongs[songPlayedId] = player.children[0].children[1].children[1].innerHTML;
    lastPlayedSongs[songPlayedId] = trenutnaPesma.src;
    songPlayedId++;
    var g = Math.floor(Math.random() * brojPesama) + 1;
    GetUrlFromRealtimeDB2(g);
    outerplayer.children[0].children[3].children[2].classList.remove('bi-play-circle-fill');
    outerplayer.children[0].children[3].children[2].classList.add('bi-pause-circle-fill');
    songPlaying = true;
})

backBtn.addEventListener('click', ()=>{
    if(songPlayedId >= 2){
        songPlayedId--;
        trenutnaPesma.src = lastPlayedSongs[songPlayedId];
        document.getElementById('songBanner').src = lastPlayedImageSongs[songPlayedId];
        document.getElementById('currentSongName').innerHTML = lastPlayedTitleSongs[songPlayedId];
        document.getElementById('currentSongCreator').innerHTML = lastPlayedCreaatorSongs[songPlayedId];
        trenutnaPesma.currentTime = 0;
        trenutnaPesma.play();
        outerplayer.children[0].children[3].children[2].classList.remove('bi-play-circle-fill');
        outerplayer.children[0].children[3].children[2].classList.add('bi-pause-circle-fill');
        songPlaying = true;
    }
    else{
        backBtn.style.animation = 'djuskaj 0.1s linear';
        setTimeout(function (){
            backBtn.style.animation = 'none';
        },100);
    }
})

var settingsBtn = document.getElementById("settings");
var settingsPage = document.getElementById("settingsPage");
var settingsCloseBtn = document.getElementById("closeSettings");

settingsBtn.addEventListener('click', () => {
    settingsPage.style.height = "100%";
    settingsPage.style.pointerEvents = "all";
})

settingsCloseBtn.addEventListener('click', () => {
    settingsPage.style.height = "0%";
    settingsPage.style.pointerEvents = "none";
})

var theme = 1;

const settingsThemeSelect = document.getElementById("settingsTheme");
const backgroundBlur = document.getElementsByClassName("backgroundBlur")[0];
const headerText = document.getElementsByClassName("headerText");
const mightLikeSongItems = document.getElementsByClassName("mightlike-songitem");
const footer = document.querySelector("footer");

settingsThemeSelect.addEventListener('change', ()=>{
    const selectedScreen = document.querySelector("footer > li.activescreen");
    if(settingsThemeSelect.value == "Light"){
        theme = 0;

        for (let i = 0; i < headerText.length; i++) {
            headerText[i].style.color = 'black';
        }

        for (let i = 0; i < mightLikeSongItems.length; i++) {
            mightLikeSongItems[i].style.backgroundImage = 'linear-gradient(225deg, rgba(220, 220, 255, 0.9), rgba(255, 255, 255, 0.9))';
            mightLikeSongItems[i].children[1].children[0].style.color = 'black';
            mightLikeSongItems[i].children[2].style.color = 'black';
        }

        player.style.backgroundColor = 'rgba(240, 235, 255, 0.8)';
        outerplayer.style.border = '1px solid rgb(200, 200, 200)';
        player.children[0].children[1].children[0].style.color = 'black';
        for (let i = 0; i < player.children[3].children.length; i++) {
                player.children[3].children[i].style.color = 'black';
        }
        currentTime.style.color = 'rgba(0, 0, 0, 0.7)';
        endTime.style.color = 'rgba(0, 0, 0, 0.7)';

        footer.style.backgroundImage = 'linear-gradient(0deg,white, rgba(255, 255, 255, 0.9),rgba(230, 230, 255, 0.7), rgba(220, 220, 255, 0.5)';
        selectedScreen.style.color = 'black';
        selectedScreen.style.filter = 'drop-shadow(0px 0px 5px rgba(0, 0, 0, 0.5))';
        selectedScreen.children[0].style.color = 'black';

        document.body.style.backgroundImage = "url('background.gif')";
        document.body.style.backgroundColor = 'rgb(225,225,225)';
        backgroundBlur.style.backdropFilter = "blur(10px) brightness(0.15) hue-rotate(290deg) invert(1)";
    }else if(settingsThemeSelect.value == "Dark"){
        theme = 1;

        for (let i = 0; i < headerText.length; i++) {
            headerText[i].style.color = 'white';
        }

        for (let i = 0; i < mightLikeSongItems.length; i++) {
            mightLikeSongItems[i].style.backgroundImage = 'linear-gradient(225deg, rgba(27, 27, 27, 0.5), rgba(78, 67, 47, 0.3))';
            mightLikeSongItems[i].children[1].children[0].style.color = 'white';
            mightLikeSongItems[i].children[2].style.color = 'white';
        }

        player.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        outerplayer.style.border = '1px solid rgb(31, 31, 31)';
        player.children[0].children[1].children[0].style.color = 'white';
        for (let i = 0; i < player.children[3].children.length; i++) {
            player.children[3].children[i].style.color = 'white';
        }
        currentTime.style.color = 'rgba(255, 255, 255, 0.5)';
        endTime.style.color = 'rgba(255, 255, 255, 0.5)';

        footer.style.backgroundImage = 'linear-gradient(0deg,black, rgba(0, 0, 0, 0.9),rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.5))';
        selectedScreen.style.color = 'white';
        selectedScreen.style.filter = 'drop-shadow(0px 0px 2px rgba(255, 255, 255, 0.5))';
        selectedScreen.children[0].style.color = 'white';

        document.body.style.backgroundColor = 'black';
        document.body.style.backgroundImage = "url('background.gif')";
        backgroundBlur.style.backdropFilter = "blur(10px) brightness(0.2)";
    }
    else if(settingsThemeSelect.value == "TrueDark"){
        theme = 2;

        for (let i = 0; i < headerText.length; i++) {
            headerText[i].style.color = 'white';
        }

        for (let i = 0; i < mightLikeSongItems.length; i++) {
            mightLikeSongItems[i].style.backgroundImage = 'linear-gradient(225deg, rgba(27, 27, 27, 0.5), rgba(78, 67, 47, 0.3))';
            mightLikeSongItems[i].children[1].children[0].style.color = 'white';
            mightLikeSongItems[i].children[2].style.color = 'white';
        }
        currentTime.style.color = 'rgba(255, 255, 255, 0.5)';
        endTime.style.color = 'rgba(255, 255, 255, 0.5)';

        player.style.backgroundColor = 'rgba(0, 0, 0, 1)';
        outerplayer.style.border = '1px solid rgb(31, 31, 31)';
        player.children[0].children[1].children[0].style.color = 'white';
        for (let i = 0; i < player.children[3].children.length; i++) {
            player.children[3].children[i].style.color = 'white';
        }

        footer.style.backgroundImage = 'linear-gradient(0deg,black, rgba(0, 0, 0, 0.9),rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.5))';
        selectedScreen.style.color = 'white';
        selectedScreen.style.filter = 'drop-shadow(0px 0px 2px rgba(255, 255, 255, 0.5))';
        selectedScreen.children[0].style.color = 'white';

        document.body.style.backgroundColor = 'black';
        document.body.style.backgroundImage = 'none';
        backgroundBlur.style.backdropFilter = "blur(10px) brightness(0.2)";
    }
})

// IF IS USING MOBILE PHONE

/* Storing user's device details in a variable*/
let details = navigator.userAgent;
  
/* Creating a regular expression 
containing some mobile devices keywords 
to search it in details string*/
let regexp = /android|iphone|kindle|ipad/i;

/* Using test() method to search regexp in details
it returns boolean value*/
let isMobileDevice = regexp.test(details);

if (isMobileDevice) {
    
} else {
    
}