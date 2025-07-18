import { useEffect, useRef, useState, useMemo } from 'react';
import { fabric } from 'fabric';
import { downloadFile, loadImage, saveFile } from '@/utils';
import exifr from 'exifr';
import EditComponent, {
  ForWardRefHandler,
} from '@/components/editComponent/editComponent';
import { logoMap } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input, InputNumber } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Worker from '../../workers/index?worker';
import message from '@/components/message/message';
import { useNavigate } from 'react-router-dom';
import logoSvg from '/vite.svg';
import { Icon } from '@iconify-icon/react';
import Lightbox from 'react-image-lightbox';
import { addDbEditInfo, clearDbEditInfo } from '@/db/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import loadingSystem from '@/components/loadingSystem/loadingSystem';
import defaultData from '@/assets/data/defaultParams.json';

// 最大上传数量
const MAXLENGHT = 5;

type ExifBaseType =
  | 'FocalLength'
  | 'FNumber'
  | 'ExposureTime'
  | 'ISO'
  | 'spaceX'
  | 'spaceY'
  | 'Model'
  | 'LensModel';

interface ExifBaseInfoListChildrenItem {
  name: ExifBaseType;
  label: string;
}

interface ExifBaseInfoListItem {
  name: string;
  children: ExifBaseInfoListChildrenItem[];
}

const descList = [
  {
    key: '0',
    name: '安全',
    color: '#C9F078',
    iconName: 'mdi:shield-check-outline',
    text: '无服务，本地处理，数据安全。',
  },
  {
    key: '1',
    name: '高效',
    color: '#FADF66',
    iconName: 'mdi:lightning-bolt-outline',
    text: '图片可批量处理，快速导出效果图。',
  },
  {
    key: '2',
    name: '自定义',
    color: '#fff',
    iconName: 'mdi:settings-outline',
    text: '可自定义设置图片的参数数据。',
  },
  {
    key: '3',
    name: '批量导图',
    color: '#8AE5F6',
    iconName: 'mdi:auto-awesome-motion',
    text: '支持批量导入导出多张图片。',
  },
  {
    key: '4',
    name: '自定义编辑',
    color: '#38A3EE',
    iconName: 'mdi:cash-edit',
    text: '照片底部部分可自行拖拽编辑。',
  },
  {
    key: '5',
    name: '多种模板',
    color: '#8B21F1',
    iconName: 'mdi:apps',
    text: '提供多种水印模板可供使用。',
  },
];

const exampleList = [
  {
    key: '0',
    url: 'https://resource.blogwxb.cn/cameraWatermark/example_1.png',
    styles: { width: '420px', height: '301px' },
  },
  {
    key: '1',
    url: 'https://resource.blogwxb.cn/cameraWatermark/example_2.png',
    styles: { height: '301px' },
  },
  {
    key: '2',
    url: 'https://resource.blogwxb.cn/cameraWatermark/example_4.png',
    styles: { width: '420px', height: '301px' },
  },
  {
    key: '3',
    url: 'https://resource.blogwxb.cn/cameraWatermark/example_5.png',
    styles: { height: '301px' },
  },
];

const Index = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const fileSingleRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<ForWardRefHandler>(null);
  const [imgInfo, setImgInfo] = useState<{
    file: File | null;
    exifInfo: any;
    imgUrl: string;
  }>({
    file: null,
    exifInfo: {},
    imgUrl: '',
  });
  const [openLogo, setOpenLogo] = useState(false);
  const defaultParams = useRef<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const updateStorage = () => {
    const data = localStorage.getItem('defaultParams');
    if (!data) {
      const list = [{ key: +new Date(), info: defaultData }];
      defaultParams.current = list;
      localStorage.setItem('defaultParams', JSON.stringify(list));
    } else {
      defaultParams.current = JSON.parse(data || '[]');
    }
  };

  useEffect(() => {
    updateStorage();
    window.addEventListener('updateStorage', updateStorage);
    if (fileRef.current) {
      fileRef.current.addEventListener('change', imgMultipleChange);
    }
    if (fileSingleRef.current) {
      fileSingleRef.current.addEventListener('change', imgSingleChange);
    }
    return () => {
      fileRef.current?.removeEventListener('change', imgMultipleChange);
      fileSingleRef.current?.removeEventListener('change', imgSingleChange);
      window.removeEventListener('updateStorage', updateStorage);
    };
  }, []);

  /**图片变化 */
  const imgChange = async (type = 'multiple') => {
    loadingSystem(true);
    await clearDbEditInfo();
    const ref = type === 'multiple' ? fileRef.current! : fileSingleRef.current!;
    const filesList = ref.files!;

    console.log('ref.files', ref.files);
    const list = [];
    for (let i = 0; i < filesList?.length; i++) {
      const info = await renderFile(filesList[i]);
      if (info) {
        list.push(info);
      }
    }
    if (!list.length) {
      message.info('图片解析失败');
      return;
    }
    const ids = await addDbEditInfo(list as any[]);
    loadingSystem(false);
    if (type === 'multiple') {
      navigate('/editList', { state: { ids } });
    } else {
      navigate('/edit', { state: { id: ids[0] } });
    }
  };

  const imgMultipleChange = () => imgChange('multiple');
  const imgSingleChange = () => imgChange('single');

  const renderFile = (file: File) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async function (e) {
        let imgUrl = URL.createObjectURL(file);
        try {
          let exifs = await exifr.parse(file, true);
          // console.log('---exifs', exifs);
          // console.log('file---', file);
          resolve({
            file,
            filename: file.name,
            exifInfo: exifs?.Make
              ? {
                  ...exifs!,
                  ExposureTime:
                    typeof exifs?.ExposureTime === 'number'
                      ? Math.floor(1 / exifs.ExposureTime)
                      : null,
                  hiddenLeftInfo: false,
                  hiddenRightInfo: false,
                  BgBlur: defaultParams.current?.[0]?.info?.BgBlur || 5,
                  ShadowBlur: defaultParams.current?.[0]?.info?.ShadowBlur || 5,
                  FontFamily:
                    defaultParams.current?.[0]?.info?.FontFamily ||
                    'Times New Roman',
                }
              : {
                  ...(defaultParams.current?.[0]?.info || {}),
                  noHasExif: true,
                },
            imgUrl,
          });
        } catch (error) {
          console.log('error:', error);
          resolve({
            file,
            exifInfo: null,
            imgUrl,
            filename: file.name,
          });
        }
      };

      reader.onerror = (e) => {
        resolve(false);
        console.log('error', e);
      };

      reader.readAsDataURL(file);
    });
  };

  return (
    <div
      className="font-bold min-h-screen pt-24 pb-16"
      style={{ minWidth: '960px', maxWidth: '1200px' }}
    >
      <input
        type="file"
        ref={fileRef}
        accept="image/*"
        className="hidden"
        multiple
      />
      <input
        type="file"
        ref={fileSingleRef}
        accept="image/*"
        className="hidden"
      />
      <div className="flex flex-col justify-center items-center">
        <section className="mb-12">
          <div className="flex items-center text-5xl">
            <img src={logoSvg} className="w-16 mr-4" />
            无忧相机水印
          </div>
          <div className="text-nowrap text-gray-500 mt-4 text-center">
            通过图片的 EXIF 信息，合成出来新的相机水印图片。
          </div>
        </section>
        <section className="flex flex-col justify-center">
          <div className="flex justify-center gap-4">
            <Button onClick={() => fileSingleRef.current?.click()}>
              单个编辑
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => fileRef.current?.click()}>
                    批量编辑
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    由于相机数字图片内存较大，防止系统崩溃，建议最多选择5张图片
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-gray-500 mt-4 mb-2">
            本软件只处理通过
            <span className="text-red-500 mx-1">单反/微单</span>
            相机设备的镜头拍摄的JPEG、TIFF等格式照片的
            <span className="text-red-500 mx-1">EXIF</span>数据进行处理
          </div>
          <div className="text-gray-500">
            请上传原始数字照片，如照片被软件编辑修改或用微信QQ转发过，EXIF信息会变化或丢失
          </div>
        </section>
        <section className="grid w-full grid-cols-2 gap-x-12 gap-y-4 mt-8">
          {descList.map((item) => (
            <div
              key={item.key}
              className="px-4 py-8 rounded-lg border-2 bg-white"
            >
              <div>
                <div className="p-2 bg-black inline-flex rounded-md">
                  <Icon
                    icon={item.iconName}
                    className="text-2xl"
                    style={{ color: item.color }}
                  ></Icon>
                </div>
              </div>
              <h1 className="text-xl my-4">{item.name}</h1>
              <p className="text-gray-500 font-normal">{item.text}</p>
            </div>
          ))}
        </section>
        <section className="mt-12 bg-white w-full rounded-lg py-4">
          <h1 className="text-2xl text-center mb-2">示例图片</h1>
          <div className="text-gray-500 text-center mb-4">
            点击可查看大图（示例图都是压缩过的，不代表最终效果，仅供参考）
          </div>
          <div className="flex justify-center mb-4">
            {exampleList.slice(0, 2).map((item, index) => (
              <div
                key={item.url}
                className={`group relative ${index % 2 === 0 ? 'mr-8' : ''}`}
              >
                <img
                  src={item.url}
                  alt={item.url}
                  style={{ ...(item.styles || {}) }}
                />
                <div
                  className="hidden group-hover:flex w-full h-full justify-center items-center bg-black bg-opacity-10 absolute left-0 top-0 cursor-pointer"
                  onClick={() => {
                    setPhotoIndex(index);
                    setIsOpen(true);
                  }}
                ></div>
              </div>
            ))}
          </div>
          <div className="flex justify-center">
            {exampleList.slice(2, 4).map((item, index) => (
              <div
                key={item.url}
                className={`group relative ${index % 2 === 0 ? 'mr-8' : ''}`}
              >
                <img
                  src={item.url}
                  alt={item.url}
                  style={{ ...(item.styles || {}) }}
                />
                <div
                  className="hidden group-hover:flex w-full h-full justify-center items-center bg-black bg-opacity-10 absolute left-0 top-0 cursor-pointer"
                  onClick={() => {
                    setPhotoIndex(index + 2);
                    setIsOpen(true);
                  }}
                ></div>
              </div>
            ))}
          </div>
        </section>
      </div>
      {isOpen && (
        <Lightbox
          mainSrc={exampleList[photoIndex].url}
          nextSrc={exampleList[(photoIndex + 1) % exampleList.length].url}
          prevSrc={
            exampleList[
              (photoIndex + exampleList.length - 1) % exampleList.length
            ].url
          }
          onCloseRequest={() => setIsOpen(false)}
          onMovePrevRequest={() =>
            setPhotoIndex(
              (photoIndex + exampleList.length - 1) % exampleList.length
            )
          }
          onMoveNextRequest={() =>
            setPhotoIndex((photoIndex + 1) % exampleList.length)
          }
        />
      )}
    </div>
  );
};

export default Index;
