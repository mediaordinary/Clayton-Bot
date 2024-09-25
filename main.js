/**
 * ======================================================
 *  Bot Clayton
 *  Diciptakeun ku Skippy
 *  Katerangan: Ieu bot otomatiskeun tugas harian, kaulinan,
 *  sareng ganjaran dina platform Clayton. 
 * ======================================================
 */

const axios = require("axios");
const fs = require("fs");
const readline = require("readline");
const querystring = require("querystring");
require('dotenv').config();

const BASE_URL = "https://tonclayton.fun";

async function readFromFile(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    const items = [];
    for await (const line of rl) {
        if (line.trim()) {
            items.push(line.trim());
        }
    }
    return items;
}

function createApiClient(initData) {
    const axiosConfig = {
        baseURL: BASE_URL,
        headers: {
            Host: "tonclayton.fun",
            "Init-Data": initData,
            Origin: BASE_URL,
            Referer: `${BASE_URL}/games/game-512`,
        },
    };

    return axios.create(axiosConfig);
}

function log(message, color = "white") {
    const colors = {
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
        white: "\x1b[37m",
    };
    console.log(colors[color] + message + "\x1b[0m");
}

async function safeRequest(api, method, url, data) {
    try {
        const response = await api[method](url, data);
        return response.data;
    } catch (error) {
        log(`Request failed: ${error.message}`, "red");
        throw error;
    }
}

const apiFunctions = {
    login: (api) => safeRequest(api, 'post', "/api/user/login", {}),
    claimDailyReward: (api) => safeRequest(api, 'post', "/api/user/daily-claim", {}),
    claimTokens: (api) => safeRequest(api, 'post', "/api/user/claim", {}),
    startFarming: (api) => safeRequest(api, 'post', "/api/user/start", {}),
    getDailyTasks: (api) => safeRequest(api, 'post', "/api/user/daily-tasks", {}),
    completeTask: (api, taskId) => safeRequest(api, 'post', `/api/user/daily-task/${taskId}/complete`, {}),
    claimTaskReward: (api, taskId) => safeRequest(api, 'post', `/api/user/daily-task/${taskId}/claim`, {}),
    playGame: async (api, gameName) => {
        await safeRequest(api, 'post', "/api/game/start", {});
        await simulateGameplay(gameName);
        await safeRequest(api, 'post', "/api/game/save-tile", { maxTile: 1024 });
        log(`${gameName} tile saved: 1024`, "cyan");
        return await safeRequest(api, 'post', "/api/game/over", {});
    }
};

async function simulateGameplay(gameName) {
    const duration = Math.floor(Math.random() * 31) + 30;
    for (let i = 0; i <= duration; i++) {
        process.stdout.write(
            `\r\x1b[36m${gameName} game in progress: ${i}s / ${duration}s [${"=".repeat(i)}${" ".repeat(
                duration - i
            )}]\x1b[0m`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log();
}

async function processAccount(initData, firstName) {
    try {
        const api = createApiClient(initData);
        let loginData = await apiFunctions.login(api);
        log("Logged in successfully", "green");

        if (loginData.dailyReward?.can_claim_today) {
            await apiFunctions.claimDailyReward(api);
            log("Daily reward claimed", "yellow");
        } else {
            log("Daily reward not available", "yellow");
        }

        if (loginData.user.can_claim) {
            await apiFunctions.claimTokens(api);
            log("Tokens claimed", "magenta");
            await apiFunctions.startFarming(api);
            log("Farming started", "blue");
        } else {
            log("Token claim not available", "magenta");
        }

        const dailyAttempts = loginData.user.daily_attempts;
        log(`Available game attempts: ${dailyAttempts}`, "cyan");
        for (let i = 1; i <= dailyAttempts; i++) {
            const gameResult = await apiFunctions.playGame(api, "1024");
            log(`1024 game ${i} result:`, "green");
            console.log(gameResult);
        }

        log("Fetching daily tasks...", "cyan");
        let tasks = await apiFunctions.getDailyTasks(api);
        for (const task of tasks) {
            if (!task.is_completed && !task.is_reward) {
                log(`Completing task: ${task.task_type} (ID: ${task.id})`, "yellow");
                const completeResult = await apiFunctions.completeTask(api, task.id);
                log(completeResult.message, "green");
            } else {
                log(`Task already completed: ${task.task_type} (ID: ${task.id})`, "yellow");
            }
        }

        tasks = await apiFunctions.getDailyTasks(api);
        for (const task of tasks) {
            if (task.is_completed && !task.is_reward) {
                log(`Claiming reward for task: ${task.task_type} (ID: ${task.id})`, "yellow");
                const claimResult = await apiFunctions.claimTaskReward(api, task.id);
                log(claimResult.message, "green");
                console.log(`Reward received: ${claimResult.reward}`);
            }
        }

        log("All tasks completed", "green");

        // Looping dengan waktu acak antara 3 hingga 6 jam
        const randomDelay = Math.floor(Math.random() * (21600000 - 10800000 + 1)) + 10800000; // 3 jam (10800000 ms) hingga 6 jam (21600000 ms)
        log(`Waiting for ${randomDelay / 3600000} hours before next operation...`, "cyan");
        await new Promise(resolve => setTimeout(resolve, randomDelay));

    } catch (error) {
        log(`Error occurred for ${firstName}: ${error.message}`, "red");
    }
}

async function main() {
    // Menampilkan header
    log("Bot Clayton - Diciptakeun ku Skippy", "cyan");
    log("Katerangan: Ieu bot otomatiskeun tugas harian, kaulinan, sareng ganjaran dina platform Clayton.", "cyan");
    
    const initData = process.env.INIT_DATA;

    // Mendapatkan data pengguna dari INIT_DATA
    const parsed = querystring.parse(initData);
    const userDecoded = decodeURIComponent(parsed.user);
    const userObject = JSON.parse(userDecoded);
    const firstName = userObject?.first_name;

    log(`Processing account: ${firstName}`, "cyan");
    await processAccount(initData, firstName);
}

// Menjalankan proses pertama kali
main();