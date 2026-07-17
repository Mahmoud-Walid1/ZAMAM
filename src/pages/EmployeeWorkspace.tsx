import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Clock, FolderDown, LogOut, Trash2, Activity, Paperclip, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const EmployeeWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<any[]>([]);

  const [userName, setUserName] = useState('...');
  const [userRole, setUserRole] = useState('...');

  React.useEffect(() => {
    let unsubscribeTasks: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserName(user.displayName || user.email?.split('@')[0] || 'مستخدم');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        let currentUserRole = 'موظف';
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.displayName) setUserName(data.displayName);
          currentUserRole = data.role || 'موظف';
          setUserRole(currentUserRole);
        }

        const tasksQuery = query(collection(db, 'tasks'));
        unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
          const allTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          const filtered = allTasks.filter((t: any) => {
            if (activeTab === 'archive') return t.status === 'Completed';
            if (t.status === 'Completed') return false;
            if (currentUserRole === 'Admin' || currentUserRole === 'المدير العام' || currentUserRole === 'DeputyManager' || currentUserRole === 'نائب المدير') {
              return true;
            }
            const currentStageData = t.pipeline?.find((p: any) => p.stage === t.currentStage);
            if (!currentStageData) return false;
            const isAssignedToMe = currentStageData.assigneeId === user.uid;
            const isMyRoleUnassigned = !currentStageData.assigneeId && currentStageData.role === currentUserRole;
            return isAssignedToMe || isMyRoleUnassigned;
          });
          setTasks(filtered);
        });
      } else {
        navigate('/');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeTasks) unsubscribeTasks();
    };
  }, [navigate, activeTab]);

  const handleMarkDone = async (task: any) => {
    // Check if file upload is required and missing
    if (task.requiresFileUpload && (!task.attachments || task.attachments.length === 0) && !task.fileLink) {
      alert("⚠️ عذراً، هذه المهمة تتطلب إرفاق ملفات العمل أولاً قبل إتمامها.");
      return;
    }

    try {
      const nextStage = task.currentStage + 1;
      const isLastStage = nextStage > (task.pipeline?.length || 0);

      const taskRef = doc(db, 'tasks', task.id);
      
      if (isLastStage) {
        await updateDoc(taskRef, {
          status: 'Completed',
          completedAt: new Date().toISOString()
        });
      } else {
        await updateDoc(taskRef, {
          currentStage: nextStage,
          status: 'In Progress'
        });
      }
    } catch (error) {
      console.error("Error updating task:", error);
      alert("حدث خطأ أثناء تحديث المهمة");
    }
  };

  const [uploading, setUploading] = useState<string | null>(null);

  const deleteAttachment = async (taskId: string, fileUrl: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الملف لتوفير مساحة؟")) return;
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnap = await getDoc(taskRef);
      if (taskSnap.exists()) {
        const currentAttachments = taskSnap.data().attachments || [];
        const updated = currentAttachments.filter((f: any) => f.url !== fileUrl);
        await updateDoc(taskRef, { attachments: updated });
      }
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  const handleFileUpload = async (taskId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setUploading(taskId);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Create a unique path for the file
        const filePath = `tasks/${taskId}/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, filePath);
        
        // Upload with metadata to help with CORS if needed
        const metadata = {
          contentType: file.type,
          customMetadata: {
            'uploader': userName,
            'taskId': taskId
          }
        };

        const uploadTask = await uploadBytes(fileRef, file, metadata);
        const url = await getDownloadURL(uploadTask.ref);
        return { name: file.name, url, type: file.type, path: filePath };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        attachments: arrayUnion(...uploadedFiles)
      });

      alert("تم رفع الملفات بنجاح إلى سحابة ZAMAM ✅");
    } catch (error: any) {
      console.error("Upload error detail:", error);
      if (error.code === 'storage/unauthorized') {
        alert("⚠️ خطأ: لا تملك صلاحية الرفع. يرجى التأكد من تسجيل الدخول.");
      } else if (error.code === 'storage/retry-limit-exceeded') {
        alert("⚠️ خطأ في الاتصال: فشل الرفع بسبب ضعف الإنترنت.");
      } else {
        alert("حدث خطأ أثناء الرفع (CORS). يرجى مراجعة إعدادات Firebase Storage.");
      }
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="min-h-screen bg-zamam-light flex flex-col font-['Cairo'] text-right">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-row-reverse items-center justify-between py-4">
            <div className="flex items-center gap-4 flex-row-reverse">
              <div className="w-12 h-12 bg-gradient-to-br from-zamam-primary to-zamam-navy rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-zamam-primary/20">
                {userName.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-black text-meta-textDark">مرحباً، {userName}</h1>
                <p className="text-xs font-bold text-meta-textGray">{userRole}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-row-reverse">
              {(userRole === 'Admin' || userRole === 'المدير العام') && (
                <button onClick={() => navigate('/admin')} className="px-5 py-2.5 bg-zamam-primary/10 text-zamam-primary rounded-xl font-black text-sm hover:bg-zamam-primary/20 transition-all">لوحة الإدارة</button>
              )}
              <button onClick={() => navigate('/')} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex gap-8 border-b border-transparent justify-end">
            <button className={`py-4 text-sm font-black border-b-2 transition-all ${activeTab === 'active' ? 'border-zamam-primary text-zamam-primary' : 'border-transparent text-meta-textGray hover:text-zamam-textDark'}`} onClick={() => setActiveTab('active')}>المهام النشطة</button>
            <button className={`py-4 text-sm font-black border-b-2 transition-all ${activeTab === 'archive' ? 'border-zamam-primary text-zamam-primary' : 'border-transparent text-meta-textGray hover:text-zamam-textDark'}`} onClick={() => setActiveTab('archive')}>الأرشيف</button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'active' ? (
            <motion.div key="active" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {tasks.filter(t => t.status !== 'Completed').map((task) => (
                <div key={task.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col hover:shadow-2xl transition-all duration-300 group">
                  <div className="mb-6">
                    <div className="flex justify-between items-start mb-6 flex-row-reverse">
                      <span className={`px-4 py-1.5 rounded-xl text-[11px] font-black ${task.priority === 'High' || task.priority === 'عالية' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>{task.priority === 'High' || task.priority === 'عالية' ? '🔥 عالية' : '⚡ متوسطة'}</span>
                      <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-zamam-primary/10 transition-colors"><Activity className="w-6 h-6 text-zamam-primary" /></div>
                    </div>
                    <div className="flex items-center gap-2 mb-1 flex-row-reverse">
                      <p className="text-[10px] font-black px-2 py-0.5 bg-gray-100 rounded text-gray-500">{task.id.slice(-5).toUpperCase()}</p>
                      <p className="text-xs text-zamam-primary font-bold">المرحلة {task.currentStage}</p>
                    </div>
                    <h3 className="text-xl font-black text-meta-textDark mb-3">{task.title}</h3>
                    <p className="text-sm font-bold text-meta-textGray leading-relaxed line-clamp-3">{task.description}</p>
                  </div>
                  
                  {/* Google Drive Link Section */}
                  <div className="mb-4">
                    {task.fileLink ? (
                      <a href={task.fileLink} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-zamam-primary text-white rounded-[1.5rem] font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-zamam-primary/20 text-sm">
                        <FolderDown className="w-5 h-5" /> مجلد Google Drive للمهمة
                      </a>
                    ) : (
                      <div className="w-full p-4 bg-gray-50 text-gray-400 rounded-[1.5rem] text-center font-bold text-xs border-2 border-dashed border-gray-100">لا يوجد رابط مجلد Drive</div>
                    )}
                  </div>

                  {/* Attachments Section */}
                  <div className="mb-6 border-t border-gray-50 pt-4 flex-1">
                    <h4 className="text-sm font-bold text-meta-textDark mb-3 text-right flex items-center justify-end gap-1">
                      <span>الملفات والمرفقات</span>
                      <Paperclip className="w-4 h-4 text-zamam-primary" />
                    </h4>
                    
                    {/* List of uploaded attachments */}
                    {task.attachments && task.attachments.length > 0 ? (
                      <div className="space-y-2 mb-4 max-h-[150px] overflow-y-auto custom-scrollbar">
                        {task.attachments.map((file: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-xs flex-row-reverse">
                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-zamam-primary hover:underline font-bold truncate flex-1 text-right max-w-[180px]">
                              {file.name}
                            </a>
                            <button 
                              onClick={() => deleteAttachment(task.id, file.url)}
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                              title="حذف الملف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2 font-bold">لا توجد ملفات مرفوعة بعد</p>
                    )}

                    {/* File Upload Input */}
                    <label className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                      uploading === task.id ? 'bg-gray-50 border-gray-200 cursor-not-allowed' : 'bg-zamam-primary/5 border-zamam-primary/20 hover:bg-zamam-primary/10'
                    }`}>
                      <Upload className="w-4 h-4 text-zamam-primary" />
                      <span className="text-xs font-black text-zamam-primary">
                        {uploading === task.id ? 'جاري الرفع...' : '+ رفع ملفات جديدة'}
                      </span>
                      <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        disabled={uploading === task.id} 
                        onChange={(e) => handleFileUpload(task.id, e.target.files)} 
                      />
                    </label>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-50 flex-row-reverse">
                    <button onClick={() => handleMarkDone(task)} className="bg-green-500 text-white px-6 py-3 rounded-2xl font-black hover:bg-green-600 transition-all flex items-center shadow-lg shadow-green-500/20 active:scale-95 text-sm"><CheckCircle className="w-4 h-4 ml-1.5" /> إتمام المهمة</button>
                    <div className="text-[11px] font-bold text-meta-textGray flex items-center">{new Date(task.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString('ar-EG')}<Clock className="w-3.5 h-3.5 ml-1.5" /></div>
                  </div>
                </div>
              ))}
              {tasks.filter(t => t.status !== 'Completed').length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-meta-textDark mb-2">أنت منجز جداً!</h3>
                  <p className="text-meta-textGray font-bold">لا توجد مهام نشطة حالياً بانتظارك.</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="archive" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {tasks.filter(t => t.status === 'Completed').map((task) => (
                <div key={task.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col opacity-80 hover:opacity-100 transition-all duration-300 group">
                  <div className="mb-6">
                    <div className="flex justify-between items-start mb-6 flex-row-reverse">
                      <span className="px-4 py-1.5 rounded-xl text-[11px] font-black bg-green-50 text-green-700">🟢 مكتملة</span>
                      <div className="p-3 bg-gray-50 rounded-2xl"><CheckCircle className="w-6 h-6 text-green-500" /></div>
                    </div>
                    <div className="flex items-center gap-2 mb-1 flex-row-reverse">
                      <p className="text-[10px] font-black px-2 py-0.5 bg-gray-100 rounded text-gray-500">{task.id.slice(-5).toUpperCase()}</p>
                    </div>
                    <h3 className="text-xl font-black text-meta-textDark mb-3">{task.title}</h3>
                    <p className="text-sm font-bold text-meta-textGray leading-relaxed line-clamp-3">{task.description}</p>
                  </div>
                  
                  {/* Google Drive Link Section */}
                  <div className="mb-4">
                    {task.fileLink ? (
                      <a href={task.fileLink} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gray-100 text-meta-textDark rounded-[1.5rem] font-bold hover:bg-gray-200 transition-all text-sm border border-gray-200">
                        <FolderDown className="w-5 h-5 text-zamam-primary" /> مجلد Google Drive للمهمة
                      </a>
                    ) : (
                      <div className="w-full p-4 bg-gray-50 text-gray-400 rounded-[1.5rem] text-center font-bold text-xs border-2 border-dashed border-gray-100">لا يوجد رابط مجلد Drive</div>
                    )}
                  </div>

                  {/* Attachments Section */}
                  {task.attachments && task.attachments.length > 0 && (
                    <div className="mb-6 border-t border-gray-50 pt-4 flex-1">
                      <h4 className="text-sm font-bold text-meta-textDark mb-3 text-right flex items-center justify-end gap-1">
                        <span>الملفات المرفقة</span>
                        <Paperclip className="w-4 h-4 text-zamam-primary" />
                      </h4>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                        {task.attachments.map((file: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-xs flex-row-reverse">
                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-zamam-primary hover:underline font-bold truncate text-right flex-1">
                              {file.name}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-50 flex-row-reverse">
                    <span className="px-4 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-black">مكتملة بالكامل</span>
                    <div className="text-[11px] font-bold text-meta-textGray flex items-center">
                      {task.completedAt ? new Date(task.completedAt).toLocaleDateString('ar-EG') : (task.createdAt?.seconds ? new Date(task.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG'))}
                      <Clock className="w-3.5 h-3.5 ml-1.5" />
                    </div>
                  </div>
                </div>
              ))}
              {tasks.filter(t => t.status === 'Completed').length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-bold text-meta-textDark mb-2">الأرشيف فارغ</h3>
                  <p className="text-meta-textGray font-bold">لا توجد مهام مكتملة في الأرشيف حالياً.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <footer className="py-10 text-center text-meta-textGray text-[10px] font-bold opacity-50">
        <p>نظام زمام | ZAMAM System © 2026</p>
      </footer>
    </div>
  );
};
