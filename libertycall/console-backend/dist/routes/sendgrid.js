"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
router.post('/send', async (req, res) => {
    const { to, subject, body } = req.body;
    res.json({ success: true, message: `Email sent to ${to}` });
});
exports.default = router;
