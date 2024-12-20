const express = require('express');
const cors = require('cors')
const mongoose = require('mongoose');
var cron = require('node-cron');
require('dotenv').config();
const path = require('path')
const app = express();
const sendMail = require('./mail');
const sendOtpMail = require('./otpmail')
const bcrypt = require('bcrypt');
const fs = require('fs');
const https = require('https');
const PORT = process.env.PORT || 9002;
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())


const options={
    key:fs.readFileSync(path.join(__dirname,'/certificates/cert.key')),
    cert:fs.readFileSync(path.join(__dirname,'/certificates/cert.crt'))
    }


// Connecting Database

mongoose.connect(process.env.DATABASE_URL)
.then(()=>{
    console.log('DB connected');
})
.catch((err)=>{
    console.log(err);
})
//Connecting Database

// mongoose.connect('mongodb://192.168.1.205:27017/secrets')
//     .then(() => {
//         console.log('DB connected');
//     })
//     .catch((err) => {
//         console.log(err);
//     })

    // Models of database 
const User = require('./models/user');
const Emp = require('./models/emp');

app.get('/',(req,res)=>{
    res.json(
        
            "Hello boss ji"
        
    )
})
// Login API
app.post('/login', async (req, res) => {
    try {
        const { email, passwordi } = req.body
        const conf = User.findOne({ email: email })  // checks from backend weather user exist or not
            .then((docs) => {
                if (docs === null) {
                    res.json({
                        isLoggedIn: false,
                    })
                }
                else {
                    checkUser(passwordi, docs.password)
                    async function checkUser(password, phash) {
                        const match = await bcrypt.compare(password, phash);  // hasing of password using bcrypt

                        if (match) {
                            res.json({
                                isLoggedIn: match,

                            });
                        }
                        else {
                            res.json({
                                isLoggedIn: false,
                            })
                        }
                    }

                }
            })

    }
    catch (error) {
        console.log(error);
    }
})

// Santa submit form API
app.post('/santasubmit', async (req, res) => {
    const {santaemails, ids } = req.body
    // console.log(santaemails,santanames)
    const check = await Emp.findById(ids)     // Finds Employee that needs to be map to assignee
    const { santaname, santaemail } = check

    if (santaemails == check.email) {
        res.json({
            submit: false
        })
    }
    else {

        const santamila = await Emp.findOne({email:santaemails})  // finds employee weather it exist in Database or not
        .then(async (ss)=>{
            if(ss===null)
            {
                res.json({

                    cid:false

                })
            }
            else{
                if (santaname === "" && santaemail === "") {                // check for, is santa already assigned to and employee or not 
                    let text1=ss.firstname;
                    let text2=" ";
                    let text3=ss.lastname;
                    const naam= text1+text2+text3;
                    const santassign = await Emp.findByIdAndUpdate(ids, { santaname: naam, santaemail: santaemails })  // find employee and update santa name and email to it
                        .then(santassign => {
                            if (santassign) {
                                const { email, firstname, lastname } = santassign
                                // console.log(santassign,santanames);
        
                                res.json({
                                    tex: true,
                                })
                                // sse.push({naam,email,firstname,lastname});
                                // console.log(sse)
                                // sendMail({ naam, email, firstname, lastname });
                                // res.send({message:"santa assigned",santassign})
        
                            }
                            else {
                                res.send({ message: "Wrong subbmission" })
                            }
                        })
                }
                else {
                    res.json({
                        tex: false,
                    })
                }
            }
        })


        

    }


})

//Scheduler for sending mail on desiered date and time

cron.schedule('0 0 26 12 *', async() => {

    const santalist= await Emp.find()
    .then(res=>{
        if(res){


            res.forEach(async(reso) =>{
                const { santaname,email,firstname,lastname } = reso;
               await sendMail(santaname,email,firstname,lastname);
                // console.log(`Santaname: ${santaname}, Santaemail: ${santaemail},email:${email}`);
                // console.log(santaemail);
                // You can use santaname and santaemail here as needed
            })
        }})
        
    

 });

//API for fetching a particular employeee name for showing it as a response on after submitting santa submit form 
app.get('/empname/:id', async (req, res) => {    
    try {
        const name = await Emp.findById(req.params.id)
        res.json(name);
    } catch (e) {
        console.error(e);
    }
})


// API for geting all employee details from database
app.get('/empl', cors(), async (req, res) => {
    try {
        const empdata = await Emp.find()
        res.json(empdata)
    } catch (e) {
        console.error(e)
    }
})


// API for deleting and employee from Database
app.delete('/empl/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await Emp.findByIdAndDelete(id)
    }
    catch (e) {
        console.error(e);
    }
})

// API to Update the details of a particular employee
app.patch('/empl/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // const {firstname,lastname,email}=req.body
        await Emp.findByIdAndUpdate(id, req.body);
        res.send({ message: "updated user" })

    } catch (e) {
        console.log(e);
    }
})

// API for registration of admin
app.post('/register', async (req, res) => {
    try {
        const count = await User.countDocuments() // check for count the no of admin exists in database
        if(count<1)
        {
            const { name, email, password } = req.body
            const saltRound = 10;
            const hashpass = await bcrypt.hash(password, saltRound);
            // Create new admin in database
            const user = await User.create({
                name,
                email,
                password: hashpass,
            })
            res.send({ message: "admin created" })

        }
        else{
            res.json({
                count:false
            })
        }
       

    }
     catch (error) {
        console.log(error);
    }
});

// API to send OTP mail
app.post('/otpmail', (req, res) => {
    const { otp_val, emu } = req.body
    if (otp_val && emu) {
        sendOtpMail({ otp_val, emu })
        res.send({ message: "OTP sent" })
    }
    else {
        res.send({ message: "Unable to sent OTP" })
    }


})

// API for sending otp mail for santa submit
app.post('/otpmailsanta',async(req,res)=>{
    const {otp_val,emu}=req.body
    if(otp_val && emu){
        const haikya= await Emp.findOne({email:emu})   
        .then((rasta)=>{
            if(rasta===null){
                res.json({
                    find:false
                })
            }
            else{
                sendOtpMail({ otp_val, emu })
                res.send({ message: "OTP sent" })
            }

        }
        )
    }
    else {
        res.send({ message: "Unable to sent OTP" })
    }
})

// API for reset password OTP
app.post('/resetotpmail', async (req, res) => {
    const { otp_val, emu } = req.body
    if (otp_val && emu) {
        const mila = await User.findOne({ email: emu })    //finds the admin from database weather it exist or not then send otp to mail
            .then((resp) => {
                if (resp === null) {
                    res.json({
                        find: false
                    })
                }
                else {
                    sendOtpMail({ otp_val, emu })
                    res.send({ message: "OTP sent" })

                }

            })

    }
    else {
        res.send({ message: "Unable to sent OTP" })
    }


})

// API for reset the password of admin
app.post('/reset', async (req, res) => {
    const { email, passwordi } = req.body
    const saltRound = 10;
    const hashpass = await bcrypt.hash(passwordi, saltRound);
    const badla = await User.findOneAndUpdate({ email: email }, { password: hashpass })  // find the admin and upadtes password
        .then((chabi) => {
            res.send({ message: "password Updated" })

        })
})

//API to add an employee in employee list of company
app.post('/emplist', async (req, res) => {

    const { firstname, lastname, email } = req.body
    const fin = await Emp.findOne({ email: email })   // check weather it is already added in database or not
        .then((final) => {
            if (final === null) {



                const emp = new Emp({
                    firstname,
                    lastname,
                    email,
                    santaname: "",
                    santaemail: ""
                })
                emp.save()
                    .then(
                        res.json({
                            ans: false
                        }))




            }
            else {
                res.json({
                    ans: true
                })
            }

        })
})

// console.log(process.env);

// app.listen(PORT, () => {
//     console.log("server is up at port", PORT);
// })


const sslServer=https.createServer(options,app);
sslServer.listen(PORT,()=>{
console.log('Secure server is listening on port',PORT)
})